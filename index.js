/**
 * API Balance Checker - SillyTavern Extension
 * 
 * 功能：查询 API 账户余额，支持以下端点：
 *   - api/usage/token (通用)
 *   - dashboard/billing/usage (OpenAI 兼容)
 *   - siliconflow (硅基流动)
 * 
 * 反编译自 index.js (javascript-obfuscator 混淆)
 */

jQuery(() => {
    console.log('API Balance Checker: Initializing button.');

    // ========== 注入按钮 UI ==========
    if ($('#api-balance-checker-button').length === 0) {
        const buttonHtml = `
            <div id="api-balance-checker-button" class="drawer">
                <div class="drawer-toggle">
                    <div class="drawer-icon fa-solid fa-wallet fa-fw closedIcon interactable" title="查询余额" data-i18n="[title]Check Balance" tabindex="0" role="button"></div>
                </div>
            </div>
        `;
        $('#extensions-settings-button').after(buttonHtml);
    }

    // ========== 注入设置面板 UI ==========
    if ($('#api-balance-checker-config-section').length === 0) {
        const configHtml = `
            <div id="api-balance-checker-config-section">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b data-i18n="API Balance Check Settings">API余额查询设置</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down interactable" tabindex="0" role="button"></div>
                </div>
                <div class="inline-drawer-content" style="display: none;">
                    <div style="padding: 10px;">
                        <label class="checkbox_label" for="api-balance-checker-auto-enabled">
                            <input type="checkbox" id="api-balance-checker-auto-enabled">
                            <span data-i18n="Auto-check balance after generation">在每次生成完成后自动查询余额</span>
                        </label>
                        <div class="checkbox_label" style="margin-top: 10px;">
                            <input type="checkbox" id="api-balance-checker-auto-notify" checked>
                            <span data-i18n="Show notification on auto-check">自动查询时显示通知</span>
                        </div>
                        <div style="margin-top: 15px;">
                            <label for="api-balance-checker-api-endpoint" data-i18n="API Endpoint Type">API端点类型:</label>
                            <select id="api-balance-checker-api-endpoint" class="text_pole">
                                <option value="api/usage/token" data-i18n="api/usage/token">api/usage/token</option>
                                <option value="dashboard/billing/usage" data-i18n="dashboard/billing/usage">dashboard/billing/usage</option>
                                <option value="siliconflow" data-i18n="siliconflow">siliconflow</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
        $('#extensions_settings').append(configHtml);

        // 从 localStorage 恢复设置
        const autoEnabled = localStorage.getItem('api-balance-checker-auto-enabled') === 'true';
        const autoNotify = localStorage.getItem('api-balance-checker-auto-notify') !== 'false';
        const apiEndpoint = localStorage.getItem('api-balance-checker-api-endpoint') || 'dashboard/billing/usage';

        $('#api-balance-checker-auto-enabled').prop('checked', autoEnabled);
        $('#api-balance-checker-auto-notify').prop('checked', autoNotify);
        $('#api-balance-checker-api-endpoint').val(apiEndpoint);
    }

    // ========== 核心查询函数 ==========
    const checkBalance = async (isAuto = false) => {
        // 禁用 HTML 转义以便显示 HTML 格式的 toast
        toastr.options.escapeHtml = false;

        const context = SillyTavern.getContext();

        // 检查 OpenAI 设置是否已加载
        if (typeof context.chatCompletionSettings === 'undefined') {
            if (!isAuto) toastr.error('OpenAI settings not loaded yet. Please wait and try again.');
            return;
        }

        const buttonIcon = $('#api-balance-checker-button .drawer-icon');

        // 非自动模式下显示加载动画
        if (!isAuto) {
            buttonIcon.toggleClass('active');
            buttonIcon.removeClass('fa-wallet').addClass('fa-spinner fa-spin');
        }

        let apiEndpoint;

        try {
            let apiKey = context.chatCompletionSettings.api_key;
            let customUrl = context.chatCompletionSettings.custom_url;

            // 如果使用自定义 API 源，尝试从 secrets 获取密钥
            if (context.chatCompletionSettings.chat_completion_source === 'custom') {
                try {
                    const headers = context.getRequestHeaders();
                    const response = await fetch('/api/secrets/view', {
                        method: 'POST',
                        headers: headers,
                    });

                    if (!response.ok) {
                        throw new Error('Failed to fetch secrets (status: ' + response.status + ')');
                    }

                    const secrets = await response.json();

                    if (secrets.api_key_custom) {
                        apiKey = secrets.api_key_custom;
                    } else {
                        throw new Error('Custom API key (api_key_custom) not found in secrets.');
                    }
                } catch (err) {
                    console.error('API Balance Checker Error:', err);
                    if (!isAuto) toastr.error('获取自定义API密钥失败: ' + err.message);
                    if (!isAuto) buttonIcon.removeClass('fa-spinner fa-spin active').addClass('fa-wallet');
                    return;
                }
            }

            if (!customUrl || !apiKey) {
                throw new Error('未在OpenAI设置中找到自定义URL或API密钥。');
            }

            apiEndpoint = localStorage.getItem('api-balance-checker-api-endpoint') || 'dashboard/billing/usage';

            // ===== 硅基流动 (SiliconFlow) 专用查询 =====
            if (apiEndpoint === 'siliconflow') {
                $('body').addClass('siliconflow-query');

                const siliconflowUrl = 'https://api.siliconflow.cn/v1/user/info';
                const siliconflowResponse = await fetch(siliconflowUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer ' + apiKey,
                    },
                });

                const siliconflowData = await siliconflowResponse.json();
                const shouldNotify = isAuto ? $('#api-balance-checker-auto-notify').is(':checked') : true;

                if (siliconflowResponse.ok) {
                    let balanceInfo = '硅基总额度: ' + siliconflowData.data.balance
                        + '<br>余额: ' + siliconflowData.data.chargeBalance
                        + ' | 赠金: ' + siliconflowData.data.totalBalance;

                    if (shouldNotify) toastr.info(balanceInfo);
                    console.log('API Balance Checker' + (isAuto ? ' Auto' : '') + ': ' + balanceInfo);
                } else {
                    const errorMsg = siliconflowData.message || '服务器返回状态 ' + siliconflowResponse.status;
                    if (shouldNotify) toastr.error('查询失败: ' + errorMsg);
                    console.error('API Balance Checker' + (isAuto ? ' Auto' : '') + ': Query failed: ' + errorMsg);
                }
            }
            // ===== 通用查询 (api/usage/token 和 dashboard/billing/usage) =====
            // 策略：优先直连，CORS 失败时自动回退代理
            else {
                const apiOrigin = new URL(customUrl).origin;
                const fullApiUrl = apiOrigin + '/' + apiEndpoint;
                const shouldNotify = isAuto ? $('#api-balance-checker-auto-notify').is(':checked') : true;

                let responseData = null;
                let usedProxy = false;

                // 第一步：尝试直连
                try {
                    const directResponse = await fetch(fullApiUrl, {
                        method: 'GET',
                        headers: {
                            'Authorization': 'Bearer ' + apiKey,
                        },
                    });
                    responseData = await directResponse.json();
                    console.log('API Balance Checker: 直连查询成功');
                } catch (directErr) {
                    // 直连失败（通常是 CORS），回退代理
                    console.warn('API Balance Checker: 直连失败，尝试代理...', directErr.message);

                    try {
                        const proxyResponse = await fetch('https://apiproxy.9e.nz/proxy-request', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                apiKey: apiKey,
                                apiUrl: fullApiUrl,
                            }),
                        });

                        if (!proxyResponse.ok) {
                            const proxyErr = await proxyResponse.json().catch(() => ({}));
                            const errorMsg = proxyErr.error || '代理服务器返回状态 ' + proxyResponse.status;
                            if (shouldNotify) toastr.error('查询失败: ' + errorMsg);
                            console.error('API Balance Checker: Proxy query failed: ' + errorMsg);
                            return;
                        }

                        responseData = await proxyResponse.json();
                        usedProxy = true;
                        console.log('API Balance Checker: 代理查询成功');
                    } catch (proxyErr) {
                        if (shouldNotify) toastr.error('查询失败: 直连和代理均不可用');
                        console.error('API Balance Checker: Both direct and proxy failed', proxyErr);
                        return;
                    }
                }

                // 解析余额数据
                let balanceText = '';

                if (responseData.total_usage !== undefined) {
                    // total_usage 格式 (以分为单位)
                    const usageDollars = responseData.total_usage / 100;
                    balanceText = 'API已使用额度: ' + usageDollars.toFixed(2);
                } else if (responseData.total_available !== undefined) {
                    // total_available 格式 (以 token 为单位)
                    const availableTokens = responseData.total_available;
                    const availableDollars = availableTokens / 500000;
                    balanceText = 'API可用额度: ' + availableDollars.toFixed(2) + ' (原始值: ' + availableTokens + ')';
                } else if (responseData.data && responseData.data.total_available !== undefined) {
                    // 嵌套 data.total_available 格式
                    const nestedAvailable = responseData.data.total_available;
                    const nestedDollars = nestedAvailable / 500000;
                    balanceText = 'API可用额度: ' + nestedDollars.toFixed(2) + ' (原始值: ' + nestedAvailable + ')';
                } else {
                    if (shouldNotify) toastr.error('查询失败: 返回数据格式不正确。');
                    console.error('API Balance Checker: Invalid data format.', responseData);
                    return;
                }

                if (shouldNotify) toastr.info(balanceText);
                console.log('API Balance Checker' + (isAuto ? ' Auto' : '') + ': ' + balanceText);
            }
        } catch (err) {
            console.error('API Balance Checker' + (isAuto ? ' Auto' : '') + ' Error:', err);
            const shouldNotify = isAuto ? $('#api-balance-checker-auto-notify').is(':checked') : true;
            if (shouldNotify) toastr.error('查询失败: ' + err.message);
        } finally {
            // 恢复 HTML 转义
            toastr.options.escapeHtml = true;

            // 移除 siliconflow 查询样式
            if (apiEndpoint === 'siliconflow') {
                $('body').removeClass('siliconflow-query');
            }

            // 恢复按钮图标
            if (!isAuto) {
                buttonIcon.removeClass('fa-spinner fa-spin active').addClass('fa-wallet');
            }
        }
    };

    // ========== 事件绑定 ==========

    // 点击按钮手动查询
    $(document).on('click', '#api-balance-checker-button', () => checkBalance(false));

    // 生成完成后自动查询
    const context = SillyTavern.getContext();
    if (context && context.eventSource) {
        context.eventSource.on(context.eventTypes.GENERATION_ENDED, () => {
            if ($('#api-balance-checker-auto-enabled').is(':checked')) {
                checkBalance(true);
            }
        });
    }

    // 设置面板折叠/展开
    $(document).on('click', '#api-balance-checker-config-section .inline-drawer-toggle', function () {
        const content = $(this).next('.inline-drawer-content');
        const icon = $(this).find('.inline-drawer-icon');
        content.slideToggle(200);
        icon.toggleClass('up down');
    });

    // 设置项变更自动保存到 localStorage
    $(document).on('change', '#api-balance-checker-auto-enabled, #api-balance-checker-auto-notify, #api-balance-checker-api-endpoint', function () {
        const id = $(this).attr('id');
        const value = $(this).is(':checkbox') ? $(this).is(':checked') : $(this).val();
        localStorage.setItem(id, value);
    });
});
