// Package config 加载 QubuiFS-Web 网关的环境变量配置。
package config

import (
	"os"
	"strings"
	"time"
)

// Config 持有网关运行期所有可调参数。
type Config struct {
	Listen           string        // 监听地址，默认 :8080
	SessionSecret    string        // cookie 签名密钥
	ConnectTimeout   time.Duration // 握手超时
	RequestTimeout   time.Duration // 代理超时
	AllowedEndpoints []string      // 端点 allowlist（空表示不限制）
	MockControl      bool          // 启用内置 mock 控制面（仅调试）
	Dev              bool          // 开发模式：打印更详细日志
}

// Load 从环境变量读取配置，缺失项使用默认值。
func Load() Config {
	c := Config{
		Listen:         envOr("QUBUIFS_WEB_LISTEN", ":8080"),
		SessionSecret:  envOr("QUBUIFS_WEB_SESSION_SECRET", "dev-insecure-secret"),
		ConnectTimeout: durOr("QUBUIFS_WEB_CONNECT_TIMEOUT", 3*time.Second),
		RequestTimeout: durOr("QUBUIFS_WEB_REQUEST_TIMEOUT", 10*time.Second),
		MockControl:   envOr("QUBUIFS_WEB_MOCK_CONTROL", "0") == "1",
		Dev:           envOr("QUBUIFS_WEB_DEV", "1") == "1",
	}
	if s := os.Getenv("QUBUIFS_WEB_ALLOWED_ENDPOINTS"); s != "" {
		for _, e := range strings.Split(s, ",") {
			if e = strings.TrimSpace(e); e != "" {
				c.AllowedEndpoints = append(c.AllowedEndpoints, e)
			}
		}
	}
	return c
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func durOr(key string, def time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return def
}
