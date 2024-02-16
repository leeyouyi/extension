/** 預設規則 */
const ruleSet = {
  id: 1,
  priority: 1,
  action: {
    type: "block",
  },
  condition: {
    urlFilter: `||example.com`,
    resourceTypes: ["main_frame", "sub_frame"],
  },
};
/** 判斷是否error page */
let isErrorPage = false;
chrome.webNavigation.onErrorOccurred.addListener(function () {
  isErrorPage = true;
});

/** 安裝時監聽 */
chrome.runtime.onInstalled.addListener(() => {
  resetRule();
});
/** 點擊icon */
chrome.action.onClicked.addListener((tab) => {
  showReadme();
});
/** 另開tab頁面 */
function showReadme() {
  chrome.tabs.create({ url: "https://example.com/extension-survey" });
}
/** 導航(url)更改前監聽 */
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  isErrorPage = false;
  (async () => {
    const getDynamicRules =
      await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIds = getDynamicRules.map((item) => item.id);

    if (details.frameType === "outermost_frame") {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds,
        addRules: [],
      });
    }
  })();
  checkUrl(details.url);
});

/** 改變符合api檢查的url格式 */
const urlFromat = (url) => {
  if (url.includes("about:blank")) {
    return false;
  }
  let https = "";
  if (url.indexOf("https") !== -1) {
    https = "https";
  } else {
    https = "http";
  }
  const urlStr = url.split(`${https}://`)[1].split("/")[0];
  const hostname = `${https}://${urlStr}`;
  return hostname;
};

/** 檢查url */
const checkUrl = (url) => {
  if (url.includes("https://example.com/")) {
    return false;
  }
  if (url.includes("about:blank")) {
    return false;
  }
  if (url.includes("chrome://")) {
    return false;
  }
  const hostname = urlFromat(url);
  validate(hostname);
};
/** 驗證api */
const validate = async (url) => {
  const validateUrl = "http://127.0.0.1:8080/url/validate";
  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  };
  try {
    const response = await fetch(validateUrl, requestOptions).then((res) =>
      res.json()
    );
    // false 為黑名單
    if (!response.valid) {
      changeRule(url);
      setTimeout(() => {
        chrome.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            if (tabs && tabs[0].id && !isErrorPage) {
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ["scripts/srcipt.js"],
              });
            }
          }
        );
      }, 500);
    }
  } catch (error) {
    console.log(error);
  }
};

/** 監聽content傳過來訊息 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const hostname = message.hostname;
  if (message.confirm) {
    changeRule(hostname, "allow");
  }
  if (!message.confirm) {
    changeRule(hostname, "block");
  }
  sendResponse("ok");
});

async function updateStaticRules(enableRulesetIds, disableCandidateIds) {
  // Create the options structure for the call to updateEnabledRulesets()
  let options = {
    enableRulesetIds: enableRulesetIds,
    disableRulesetIds: disableCandidateIds,
  };
  // Get the number of enabled static rules
  const enabledStaticCount =
    await chrome.declarativeNetRequest.getEnabledRulesets();
  // Compare rule counts to determine if anything needs to be disabled so that
  // new rules can be enabled
  const proposedCount = enableRulesetIds.length;
  if (
    enabledStaticCount + proposedCount >
    chrome.declarativeNetRequest.MAX_NUMBER_OF_ENABLED_STATIC_RULESETS
  ) {
    options.disableRulesetIds = disableCandidateIds;
  }
  // Update the enabled static rules

  await chrome.declarativeNetRequest.updateEnabledRulesets(options);
}

/** 重至規則 */
async function resetRule() {
  const newRules = [ruleSet];
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldRuleIds = oldRules.map((rule) => rule.id);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldRuleIds,
    addRules: newRules,
  });
}

/** 更改規則 */
async function changeRule(url, type) {
  const getDynamicRules = await chrome.declarativeNetRequest.getDynamicRules();
  const blockUrlAry = getDynamicRules.map((item) => item.condition.urlFilter);
  let https = "";
  if (url.indexOf("https") !== -1) {
    https = "https";
  } else {
    https = "http";
  }
  let urlStr = url.replace(`${https}://`, "");
  if (urlStr.indexOf("www.") !== -1) {
    urlStr = urlStr.replace("www.", "");
  }
  let oldRule =
    getDynamicRules.find(
      (rule) => rule.condition.urlFilter === `||${urlStr}`
    ) || ruleSet;

  const id = oldRule ? oldRule.id : 1;

  if (type === "allow") {
    const newRule = {
      ...oldRule,
      action: {
        type: type,
      },
    };
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [id],
      addRules: [newRule],
    });
  }
  if (type === "block") {
    const newRule = {
      ...oldRule,
      action: {
        type: type,
      },
    };
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [id],
      addRules: [newRule],
    });
    sendMsgToContentScript(url);
  }

  if (!blockUrlAry.includes(`||${urlStr}`)) {
    const ruleSet = {
      id: 1,
      priority: 1,
      action: {
        type: "block",
      },
      condition: {
        urlFilter: `||${urlStr}`,
        resourceTypes: ["main_frame", "sub_frame"],
      },
    };

    const newRules = [ruleSet];
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: newRules,
      removeRuleIds: [id],
    });
  }
}

/**發送訊息至content */
async function sendMsgToContentScript() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ["scripts/reload.js"],
    });
  });
}

/** 取得目前分頁 */
async function getCurrentTab() {
  const queryOptions = { active: true, lastFocusedWindow: true };
  const [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}
