# 第三方数据说明

## free-exercise-db

力量动作元数据来自 [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db)，固定在提交 `a859101d633a01c4a1a920d6a8ce41dabba0705f`。上游项目按 [Unlicense](https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE.md) 提供。

`src/data/exercise-catalog.json` 仅收录上游 `strength`、`powerlifting`、`olympic weightlifting` 和 `strongman` 类别中的 678 个动作，保留原始英文名称、说明和静态图片路径。图片未打包进本仓库，页面联网时从固定版本的 CDN 加载。中文肌群、器械和少量常见动作别名由 FitTrack 提供。

## Three.js

器械 3D 预览使用 [Three.js](https://threejs.org/)（MIT License）。哑铃、杠铃与壶铃模型由 FitTrack 使用基础几何体在本地生成，不依赖第三方模型文件或网络请求。
