// Package gateway 实现 QubuiFS-Web 的 Web 网关：会话管理、握手、控制面代理。
package gateway

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/sessions"
)

// SessionCookieName 是浏览器侧的 cookie 名。
const SessionCookieName = "qubuifs_web_session"

// SessionState 是握手成功后会话内保存的状态。
type SessionState struct {
	Connected   bool       `json:"connected"`
	Endpoint    string     `json:"endpoint,omitempty"`
	DisplayName string     `json:"display_name,omitempty"`
	ConnectedAt *time.Time `json:"connected_at,omitempty"`
	Health      *Health    `json:"health,omitempty"`
	Ready       *Ready     `json:"ready,omitempty"`
	Version     *Version   `json:"version,omitempty"`
	Message     string     `json:"message,omitempty"` // 失败原因
	Detail      string     `json:"detail,omitempty"`  // 失败详情
}

// Health 对齐控制面 /healthz 响应 data。
type Health struct {
	Status string `json:"status"`
}

// Ready 对齐控制面 /readyz 响应 data。
type Ready struct {
	Ready  bool   `json:"ready"`
	Reason string `json:"reason,omitempty"`
}

// Version 对齐控制面 /version 响应 data。
type Version struct {
	Version   string `json:"version"`
	GitCommit string `json:"git_commit,omitempty"`
	BuildTime string `json:"build_time,omitempty"`
}

// SessionStore 维护 gorilla/sessions cookie store 与内存中的会话状态。
// cookie 仅持有 sessionID，真实状态在内存 map 中，重启即失（调试阶段足够）。
type SessionStore struct {
	cookies  *sessions.CookieStore
	mu       sync.RWMutex
	states   map[string]*SessionState
}

// NewSessionStore 创建 cookie store。secret 用于签名/加密。
func NewSessionStore(secret string) *SessionStore {
	cs := sessions.NewCookieStore([]byte(secret))
	cs.Options = &sessions.Options{
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   86400 * 7, // 7 天
	}
	return &SessionStore{
		cookies: cs,
		states:  make(map[string]*SessionState),
	}
}

// Get 从请求中读取会话状态。无会话时返回 nil。
func (s *SessionStore) Get(r *http.Request) *SessionState {
	sess, err := s.cookies.Get(r, SessionCookieName)
	if err != nil || sess == nil {
		return nil
	}
	id, _ := sess.Values["sid"].(string)
	if id == "" {
		return nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	st, ok := s.states[id]
	if !ok {
		return nil
	}
	// 返回拷贝避免外部修改
	cp := *st
	return &cp
}

// Set 写入或更新会话状态，并把 sessionID 写到 cookie。
func (s *SessionStore) Set(w http.ResponseWriter, r *http.Request, st *SessionState) error {
	sess, err := s.cookies.Get(r, SessionCookieName)
	if err != nil || sess == nil {
		sess = sessions.NewSession(s.cookies, SessionCookieName)
	}
	id, _ := sess.Values["sid"].(string)
	if id == "" {
		id = randID(16)
		sess.Values["sid"] = id
	}
	s.mu.Lock()
	s.states[id] = st
	s.mu.Unlock()
	return sess.Save(r, w)
}

// Clear 清除会话状态与 cookie。
func (s *SessionStore) Clear(w http.ResponseWriter, r *http.Request) {
	sess, _ := s.cookies.Get(r, SessionCookieName)
	if sess != nil {
		if id, _ := sess.Values["sid"].(string); id != "" {
			s.mu.Lock()
			delete(s.states, id)
			s.mu.Unlock()
		}
		sess.Options.MaxAge = -1
		sess.Save(r, w)
	}
}

// IsConnected 判断当前会话是否已连接。
func (s *SessionStore) IsConnected(r *http.Request) bool {
	st := s.Get(r)
	return st != nil && st.Connected
}

// EndpointFor 返回当前会话绑定的端点（已连接时）。
func (s *SessionStore) EndpointFor(r *http.Request) string {
	st := s.Get(r)
	if st == nil {
		return ""
	}
	return st.Endpoint
}

// writeJSON 是统一的 JSON 响应工具。
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// apiError 是网关返回给前端的错误结构，与控制面 {code,message,data} 同构。
type apiError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
	Data    any    `json:"data"`
}

func writeAPIError(w http.ResponseWriter, status, code int, message, detail string) {
	writeJSON(w, status, apiError{Code: code, Message: message, Detail: detail, Data: nil})
}

// randID 生成 n 字节的十六进制字符串。不引入 uuid 依赖。
func randID(n int) string {
	b := make([]byte, n)
	for i := range b {
		b[i] = byte(time.Now().UnixNano() >> uint(i*8))
	}
	const hex = "0123456789abcdef"
	out := make([]byte, n*2)
	for i, c := range b {
		out[i*2] = hex[c>>4]
		out[i*2+1] = hex[c&0x0f]
	}
	// 加入额外熵避免快速调用产生相同 id
	return string(out) + strconvNow()
}

// strconvNow 返回纳秒级时间戳的 36 进制表示。
func strconvNow() string {
	now := time.Now().UnixNano()
	var buf [16]byte
	i := len(buf)
	for now > 0 {
		i--
		buf[i] = "0123456789abcdefghijklmnopqrstuvwxyz"[now%36]
		now /= 36
	}
	return string(buf[i:])
}

// isMockEndpoint 判断端点是否走内置 mock。
func isMockEndpoint(endpoint string) bool {
	return strings.HasPrefix(endpoint, "mock://")
}
