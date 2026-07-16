# ErosIris-Link Lite

面向网络咨询场景的轻量静态网页版。打开网页即可完成音响需求反推、系统框图、线材清单和咨询报告。

## 保留能力

- 文字快捷指令输入音响需求
- 小蝶状态感知操作教学与首次“9 空格 3 回车”挑战
- 音响、功放、DSP、调音台需求反推
- 自动设备创建与智能连线
- 功率、阻抗、接口和通道校验
- 系统框图、设备与连接清单
- 线材采购汇总
- 接线教学与设备接口图
- 调音台内部路由和输入输出矩阵
- 模板库、配置导入导出
- 精简咨询报告与 CSV 导出
- 手机底部主导航、更多功能面板、全屏弹窗与横滑框图工具条

导航中从“乐手小卡”开始的演出工作流保留为本地版进阶功能入口，网页端不加载人物资料和3D模型，并标注“欢迎内测体验”。
点击“欢迎内测体验”可查看开发者微信、定制说明与支持作者二维码。

## 数据与隐私

这是纯静态网页，没有服务器数据库。方案默认保存在当前浏览器的 `localStorage` 与 `IndexedDB` 中，不会自动上传客户配置。

## 本地预览

```bash
python3 -m http.server 8931
```

然后打开 `http://localhost:8931/`。

可用 URL 参数直接带入咨询需求：

```text
?action=reverse&reverse=我要8只全频，4只超低
```

## 检查

```bash
tests/checksyntax.sh js/*.js
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc tests/test-lite-core.js
```

## 部署

推送到 GitHub 后，仓库中的 GitHub Actions 会自动发布到 GitHub Pages。
