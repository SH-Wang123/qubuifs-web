package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

// handleProxy 处理 /api/control/* 的反向代理。
// 规则：
//   - 未连接 → 409 not_connected
//   - mock:// 端点 → 走内置 mock
//   - 控制面网络错误 → 502
//   - 控制面 501 → 透传但 message 前缀 "后端未实现:"
//   - 其他 → 透传响应体
func (g *Gateway) handleProxy(w http.ResponseWriter, r *http.Request) {
	st := g.sessions.Get(r)
	if st == nil || !st.Connected {
		writeAPIError(w, http.StatusConflict, -1, "not_connected", "no active control plane session")
		return
	}

	// 剥离 /api/control 前缀
	rel := strings.TrimPrefix(r.URL.Path, "/api/control")
	if rel == "" || rel == "/" {
		rel = "/"
	}
	if !strings.HasPrefix(rel, "/") {
		rel = "/" + rel
	}

	// mock 模式：直接交给 mock handler
	if isMockEndpoint(st.Endpoint) {
		g.serveMock(w, r, rel)
		return
	}

	// 仅解析端点的 scheme + host，path 由 rel 覆盖。
	// 注意：若把 rel 拼进 target.Path，NewSingleHostReverseProxy 的默认 Director
	// 会用 singleJoiningSlash(target.Path, req.URL.Path) 再次拼接原始请求路径
	// （此时仍带 /api/control 前缀），导致最终路径变成 /xxx/api/control/xxx → 404。
	endpointURL, err := url.Parse(st.Endpoint)
	if err != nil {
		writeAPIError(w, http.StatusBadGateway, -1, "invalid endpoint", err.Error())
		return
	}

	// 用 httputil 反向代理但自定义错误处理与 Transport
	proxy := httputil.NewSingleHostReverseProxy(endpointURL)
	proxy.Transport = g.client.Transport
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		// 用剥离 /api/control 前缀后的相对路径覆盖，使控制面收到 /healthz 而非 /api/control/healthz
		req.URL.Path = rel
		// 透传 query
		req.URL.RawQuery = r.URL.RawQuery
		// 注入转发头
		req.Header.Set("X-Forwarded-For", r.RemoteAddr)
		req.Header.Set("X-Forwarded-Proto", "http")
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, req *http.Request, err error) {
		g.logf("proxy: %s %s -> %s error: %v", r.Method, rel, endpointURL.String(), err)
		writeAPIError(w, http.StatusBadGateway, -1, "control plane unreachable", err.Error())
	}
	// 自定义 ModifyResponse 拦截 501 并打标
	proxy.ModifyResponse = func(resp *http.Response) error {
		if resp.StatusCode == http.StatusNotImplemented {
			// 尝试读取并改写 message
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			cr := &controlResponse{}
			if jerr := json.Unmarshal(body, cr); jerr == nil && cr.Message != "" {
				cr.Message = "后端未实现: " + cr.Message
				newBody, _ := json.Marshal(cr)
				resp.Body = io.NopCloser(strings.NewReader(string(newBody)))
				resp.ContentLength = int64(len(newBody))
				resp.Header.Set("Content-Length", fmt.Sprintf("%d", len(newBody)))
			} else {
				// 无法解析则原样回写
				resp.Body = io.NopCloser(strings.NewReader(string(body)))
				resp.ContentLength = int64(len(body))
				resp.Header.Set("Content-Length", fmt.Sprintf("%d", len(body)))
			}
		}
		return nil
	}

	// 设置超时 context
	ctx, cancel := context.WithTimeout(r.Context(), g.cfg.RequestTimeout)
	defer cancel()
	r = r.WithContext(ctx)

	g.logf("proxy: %s %s -> %s", r.Method, rel, endpointURL.String())
	proxy.ServeHTTP(w, r)
}
