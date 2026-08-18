.PHONY: web-build web-dev gateway clean

# 构建前端 dist 并同步到 internal/static/dist
web-build:
	cd web && npm run build
	@echo ">> 同步 web/dist 到 internal/static/dist"
	rm -rf internal/static/dist
	cp -r web/dist internal/static/dist

# 启动 Vite 开发服务器（热重载）
web-dev:
	cd web && npm run dev

# 构建前端 + 编译 Go 二进制
gateway: web-build
	@echo ">> 构建 qubuifs-web 二进制"
	go build -o bin/qubuifs-web ./cmd/web

clean:
	rm -rf bin/qubuifs-web web/dist
