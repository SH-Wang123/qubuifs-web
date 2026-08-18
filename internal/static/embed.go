// Package static 通过 embed.FS 嵌入前端构建产物。
// 在 Makefile/构建脚本中先把 web/dist 拷贝到 internal/static/dist 后再 build。
package static

import "embed"

//go:embed all:dist
var Dist embed.FS

// Sub 返回 dist 子树作为 fs.FS。
func Sub() (any, error) {
	return Dist, nil
}
