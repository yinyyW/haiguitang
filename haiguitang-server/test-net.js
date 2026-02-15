// test-net.js
const { ProxyAgent, setGlobalDispatcher, fetch } = require('undici');
const { GoogleGenerativeAI } = require('@google/generative-ai')
const proxyAgent = new ProxyAgent('http://127.0.0.1:7897'); // 换成你的端口
setGlobalDispatcher(proxyAgent);
const genAI = new GoogleGenerativeAI('AIzaSyCehxL8lTk9y0qFJX2EYB9Q-55HqvR8wdg');

async function check() {
    try {
        const resp = await fetch('https://generativelanguage.googleapis.com');
        console.log("状态码:", resp.status); // 看到 404 或 200 都代表网络通了
    } catch (e) {
        console.error("依然连接失败:", e.message);
    }
}
// check();
async function listSupportedModels() {
    try {
        // 注意：listModels 也是在 v1beta 路径下的
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyCehxL8lTk9y0qFJX2EYB9Q-55HqvR8wdg`;
        const response = await fetch(url);
        const data = await response.json();

        console.log("你的 Key 支持的模型列表：");
        data.models.forEach(m => console.log(`- ${m.name}`));
    } catch (e) {
        console.error("无法获取模型列表，可能是网络代理或 Key 权限问题:", e.message);
    }
}
listSupportedModels()