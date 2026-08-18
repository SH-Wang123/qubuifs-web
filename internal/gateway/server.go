package gateway

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/qubuifs/web/internal/config"
)

// Gateway 是 QubuiFS-Web 网关的核心对象。
type Gateway struct {
	cfg      config.Config
	sessions *SessionStore
	client   *http.Client
	logger   *log.Logger
	static   fs.FS // 嵌入的静态资源（前端 dist）
}

// Option 用于构造时注入可选依赖。
type Option func(*Gateway)

// WithStaticFS 注入静态资源文件系统（来自 embed.FS）。
func WithStaticFS(fsys fs.FS) Option {
	return func(g *Gateway) { g.static = fsys }
}

// WithLogger 注入自定义 logger。
func WithLogger(l *log.Logger) Option {
	return func(g *Gateway) { g.logger = l }
}

// New 构造 Gateway。
func New(cfg config.Config, opts ...Option) *Gateway {
	g := &Gateway{
		cfg:      cfg,
		sessions: NewSessionStore(cfg.SessionSecret),
		client: &http.Client{
			Timeout: cfg.RequestTimeout,
		},
		logger: log.Default(),
	}
	for _, opt := range opts {
		opt(g)
	}
	return g
}

// logf 是统一日志入口，dev 模式下更详细。
func (g *Gateway) logf(format string, args ...any) {
	if g.cfg.Dev {
		g.logger.Printf("[gateway] "+format, args...)
	}
}

// Handler 返回根 http.Handler，注册所有路由。
func (g *Gateway) Handler() http.Handler {
	mux := http.NewServeMux()

	// API 路由
	mux.HandleFunc("/api/session/connect", g.withMethod("POST", g.handleConnect))
	mux.HandleFunc("/api/session/probe", g.withMethod("POST", g.handleProbe))
	mux.HandleFunc("/api/session", g.sessionHandler) // GET/DELETE
	mux.HandleFunc("/api/control/", g.handleProxy)

	// 健康检查（容器探针用）
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
	})

	// 静态资源：embed.FS 优先，缺失时回退到 SPA index.html
	if g.static != nil {
		fileServer := http.FileServer(http.FS(g.static))
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			// 清理路径
			path := strings.TrimPrefix(r.URL.Path, "/")
			if path == "" {
				path = "index.html"
			}
			// 检查文件存在性
			if _, err := fs.Stat(g.static, path); err != nil {
				// SPA fallback：所有未知路径都返回 index.html
				r2 := r.Clone(r.Context())
				r2.URL.Path = "/"
				fileServer.ServeHTTP(w, r2)
				return
			}
			fileServer.ServeHTTP(w, r)
		})
	} else {
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			writeJSON(w, http.StatusOK, map[string]any{
				"name":    "qubuifs-web",
				"message": "static assets not embedded; run `npm run build` in web/ and rebuild",
			})
		})
	}

	// 包装中间件：日志 + CORS（dev）+ panic 恢复
	return g.recoverMiddleware(g.logMiddleware(mux))
}

// sessionHandler 处理 GET/DELETE /api/session。
func (g *Gateway) sessionHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		g.handleSessionGet(w, r)
	case http.MethodDelete:
		g.handleSessionDelete(w, r)
	default:
		w.Header().Set("Allow", "GET, DELETE")
		writeAPIError(w, http.StatusMethodNotAllowed, -1, "method not allowed", r.Method)
	}
}

// withMethod 包装只允许特定方法的 handler。
func (g *Gateway) withMethod(method string, h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != method {
			w.Header().Set("Allow", method)
			writeAPIError(w, http.StatusMethodNotAllowed, -1, "method not allowed", r.Method)
			return
		}
		h(w, r)
	}
}

// logMiddleware 记录每个请求的方法、路径、状态、耗时。
func (g *Gateway) logMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !g.cfg.Dev {
			next.ServeHTTP(w, r)
			return
		}
		start := time.Now()
		rw := &statusRecorder{ResponseWriter: w, status: 200}
		next.ServeHTTP(rw, r)
		// 跳过静态资源日志噪音
		if strings.HasPrefix(r.URL.Path, "/assets/") || r.URL.Path == "/favicon.svg" {
			return
		}
		g.logger.Printf("[http] %s %s -> %d (%dms)",
			r.Method, r.URL.Path, rw.status, time.Since(start).Milliseconds())
	})
}

// recoverMiddleware 捕获 panic 防止进程退出。
func (g *Gateway) recoverMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				g.logger.Printf("[panic] %s %s: %v", r.Method, r.URL.Path, rec)
				writeAPIError(w, http.StatusInternalServerError, -1, "internal error",
					jsonEncodeSafe(rec))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// statusRecorder 记录响应状态码。
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (sr *statusRecorder) WriteHeader(code int) {
	sr.status = code
	sr.ResponseWriter.WriteHeader(code)
}

// jsonEncodeSafe 安全序列化任意值为 JSON 字符串。
func jsonEncodeSafe(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("%v", v)
	}
	return string(b)
}
