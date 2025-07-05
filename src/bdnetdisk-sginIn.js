console.log("这是一个测试脚本，测试 stash的 js 脚本是怎么样运行的")

// 这是一个百度网盘 stash 自动签到脚本
/**
 * ProxyPin 百度网盘自动签到脚本 - 优化版
 * 功能：监听百度网盘请求，自动检测签到状态并执行签到
 */

// ==================== 工具函数 ====================

/**
 * 日志输出函数
 */
function log(message, level = 'INFO') {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [ProxyPin-${level}] ${message}`);
}

/**
 * 延时函数
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 统一的 HTTP 请求函数
 */
async function httpRequest(context, url, action) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const resp = await $httpClient.get( {
            url,
            headers: { ...context.headers, 'Cookie': context.cookie },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        log(resp)
        if (!resp?.ok) {
            log(`${action}失败, 状态码: ${resp.status}`);
            return null;
        }

        return await resp.text();
    } catch (error) {
        log(`${action}请求异常: ${error.message}`);
        return null;
    }
}

/**
 * 提取数据的通用函数
 */
function extractData(text, patterns) {
    const result = {};
    for (const [key, pattern] of Object.entries(patterns)) {
        const match = text.match(pattern);
        result[key] = match ? match[1] : null;
    }
    return result;
}

// ==================== 百度网盘签到功能 ====================

/**
 * 执行每日签到
 */
async function signin(context) {
    const url = "https://pan.baidu.com/rest/2.0/membership/level?app_id=250528&web=5&method=signin";
    const data = await httpRequest(context, url, "签到");

    if (data) {
        const { points, error_msg } = extractData(data, {
            points: /points":(\d+)/,
            error_msg: /"error_msg":"(.*?)"/
        });

        if (points) {
            log(`签到成功, 获得积分: ${points}`);
        } else {
            log("签到成功, 但未检索到积分信息");
        }

        if (error_msg) {
            log(`签到错误信息: ${error_msg}`);
        }
    }
}

/**
 * 获取日常问题
 */
async function getDailyQuestion(context) {
    const url = "https://pan.baidu.com/act/v2/membergrowv2/getdailyquestion?app_id=250528&web=5";
    const data = await httpRequest(context, url, "获取日常问题");

    if (data) {
        const { answer, ask_id } = extractData(data, {
            answer: /"answer":(\d+)/,
            ask_id: /"ask_id":(\d+)/
        });

        if (answer && ask_id) {
            return [answer, ask_id];
        } else {
            log("未找到日常问题或答案");
        }
    }

    return [null, null];
}

/**
 * 回答每日问题
 */
async function answerQuestion(context, answer, askId) {
    const url = `https://pan.baidu.com/act/v2/membergrowv2/answerquestion?app_id=250528&web=5&ask_id=${askId}&answer=${answer}`;
    const data = await httpRequest(context, url, "答题");

    if (data) {
        const { score, show_msg } = extractData(data, {
            score: /"score":(\d+)/,
            show_msg: /"show_msg":"(.*?)"/
        });

        if (score) {
            log(`答题成功, 获得积分: ${score}`);
        } else {
            log("答题成功, 但未检索到积分信息");
        }

        if (show_msg) {
            log(`答题信息: ${show_msg}`);
        }
    }
}

/**
 * 获取用户信息
 */
async function getUserInfo(context) {
    const url = "https://pan.baidu.com/rest/2.0/membership/user?app_id=250528&web=5&method=query";
    const data = await httpRequest(context, url, "获取用户信息");

    if (data) {
        const { current_value, current_level } = extractData(data, {
            current_value: /current_value":(\d+)/,
            current_level: /current_level":(\d+)/
        });

        const levelMsg = `当前会员等级: ${current_level || '未知'}, 成长值: ${current_value || '未知'}`;
        log(levelMsg);
    }
}

/**
 * 创建请求上下文
 */
function createContext(cookie) {
    return {
        cookie,
        headers: {
            'Connection': 'keep-alive',
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty',
            'Referer': 'https://pan.baidu.com/wap/svip/growth/task',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        }
    };
}

/**
 * 签到主流程
 */
async function main(cookie) {
    const context = createContext(cookie);

    try {
        log('=== 开始执行百度网盘自动签到 ===');

        await signin(context);

        // 等待3秒
        log('等待3秒');
        await sleep(3000);

        const [answer, askId] = await getDailyQuestion(context);
        if (answer && askId) {
            await answerQuestion(context, answer, askId);
        }

        await getUserInfo(context);

        log('=== 百度网盘自动签到完成 ===');
    } catch (error) {
        log(`签到主流程异常: ${error.message}`);
    }
}

// ==================== ProxyPin 适配功能 ====================

/**
 * 提取并验证 Cookie
 */
function extractValidCookie(headers) {
    const cookie = headers['Cookie'] || headers['cookie'];

    if (!cookie || !['BDUSS', 'STOKEN'].some(key => cookie.includes(key))) {
        log(cookie ? 'Cookie 中缺少必要的百度认证信息' : '请求头中未找到 Cookie', 'WARN');
        return null;
    }

    return cookie;
}

/**
 * 检查是否需要处理（基于签到状态）
 */
function shouldProcess(body) {
    return true;
    if (body?.data?.today_signed !== false) {
        log(body?.data?.today_signed === true ? '用户今日已签到，无需处理' : '响应中未找到签到状态信息，跳过处理');
        return false;
    }
    return true;
}

// ==================== ProxyPin 钩子函数 ====================

/**
 * ProxyPin onResponse 钩子函数
 */
async function onResponse(request, response) {
    try {
        const cookie = extractValidCookie(request.headers);
        if (!cookie) return onDone();

        let body;
        try {
            body = JSON.parse(response.body);
        } catch (parseError) {
            log(`响应体解析失败: ${parseError.message}`, 'WARN');
            return onDone();
        }

        if (!shouldProcess(body)) return onDone();

        log('检测到用户未签到，准备执行自动签到');
        log(`使用的 Cookie: ${cookie.substring(0, 50)}...`);

        // 异步执行签到，避免阻塞响应
        main(cookie);

        response.body = JSON.stringify(body);
    } catch (error) {
        log(`onResponse 处理异常: ${error.message}`, 'ERROR');
    }

    return onDone({body:response.body});
}

// 最后的结束方法，必须有

/**
 * 
 * @param {
 * status：修改响应的状态码
 * headers：修改响应的 headers
 * body：修改响应的 body
 * 你可以调用 $done() 来打断请求，或者 $done({}) 不修改响应的任何内容。
 * } obj 
 * @returns 
 */
function onDone(obj = {}){
    /**
     * status：修改响应的状态码
     * headers：修改响应的 headers
     * body：修改响应的 body
     * 你可以调用 $done() 来打断请求，或者 $done({}) 不修改响应的任何内容。
     */
    if($done){
        $done(obj)
    }
}
onResponse($request, $response)
