// Command qubuifs-web 启动 QubuiFS-Web 网关：会话握手 + 控制面反向代理 + 静态前端。
//
// 调试模式启动（含内置 mock 控制面）：
//
//	QUBUIFS_WEB_MOCK_CONTROL=1 go run ./cmd/web
//
// 然后浏览器访问 http://localhost:8080，端点输入框填 mock://local 即可进入管理界面。
//
// 标准模式（指向真实控制面）：
//
//	go run ./cmd/web
//	# 浏览器访问 http://localhost:8080，端点输入 http://10.0.0.12:9665
package main

import (
	"context"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/qubuifs/web/internal/config"
	"github.com/qubuifs/web/internal/gateway"
	"github.com/qubuifs/web/internal/static"
)

func main() {
	cfg := config.Load()
	logger := log.New(os.Stdout, "", log.LstdFlags|log.Lmsgprefix)
	logger.Printf("[main] qubuifs-web starting (listen=%s mock=%v dev=%v)", cfg.Listen, cfg.MockControl, cfg.Dev)

	// 嵌入前端 dist 子树
	staticFS, err := fs.Sub(static.Dist, "dist")
	if err != nil {
		logger.Fatalf("[main] cannot open embedded static fs: %v", err)
	}

	gw := gateway.New(cfg, gateway.WithStaticFS(staticFS), gateway.WithLogger(logger))
	server := &http.Server{
		Addr:              cfg.Listen,
		Handler:           gw.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// 优雅关闭
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-stop
		logger.Printf("[main] shutting down...")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			logger.Printf("[main] shutdown error: %v", err)
		}
	}()

	if cfg.MockControl {
		logger.Printf("[main] mock control plane enabled; enter 'mock://local' as endpoint on connect page")
	}
	logger.Printf("[main] listening on http://localhost%s", portFor(cfg.Listen))
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Fatalf("[main] server error: %v", err)
	}
	logger.Printf("[main] stopped")
}

// portFor 返回用于日志显示的端口段。
func portFor(listen string) string {
	if len(listen) > 0 && listen[0] == ':' {
		return listen
	}
	return fmt.Sprintf(" (%s)", listen)
}
