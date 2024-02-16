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
let isCheck = false;
let checkObj = {};
chrome.webNavigation.onErrorOccurred.addListener(function (details) {
  // console.log("Error occurred in tab ID: " + details.tabId);
  isErrorPage = true;
});

/** 安裝時監聽 */
chrome.runtime.onInstalled.addListener((details) => {
  // console.log("onInstalled", details);
  resetRule();
  /** 安裝事件 */
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    // showReadme();
  }
  /** 解除安裝事件 */
  // if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
  //   chrome.runtime.setUninstallURL("https://example.com/extension-survey");
  // }

  // if (details.eason === "update") {
  //   chrome.tabs.create({
  //     url: "onboarding.html",
  //   });
  // }
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
  console.log("onBeforeNavigate", details);
  isErrorPage = false;

  (async () => {
    // const getFrame = await chrome.webNavigation.getFrame({
    //   documentId: 0,
    //   frameId: details.detailsId,
    //   tabId: details.tabId,
    //   processId: details.processId,
    // });
    // console.log(getFrame);

    const getDynamicRules =
      await chrome.declarativeNetRequest.getDynamicRules();
    console.log(getDynamicRules);
    const ruleIds = getDynamicRules.map((item) => item.id);
    // console.log(ruleIds);

    if (details.frameType === "outermost_frame") {
      const url = urlFromat(details.url);
      if (checkObj.hostname !== url) {
        checkObj = {};
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIds,
          addRules: [],
          // addRules: [],
        });
      }
    }

    // const ruleIds = getDynamicRules.map((rule) => rule.id.toString());
    // console.log(ruleIds);
    // updateStaticRules([], ["ruleset_1"]);
  })();
  // chrome.webNavigation.onCompleted.addListener((details) => {
  //   console.log("onCompleted", details);
  // });
  // if (details.frameId === 0) {
  //   return false;
  // }

  checkUrl(details.url);
});

/** 改變符合api檢查格式 */
const urlFromat = (url) => {
  console.log(url);
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
const checkUrl = (url, obj) => {
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
  // let https = "";
  // if (url.indexOf("https") !== -1) {
  //   https = "https";
  // } else {
  //   https = "http";
  // }
  // const urlStr = url.split(`${https}://`)[1].split("/")[0];
  // const hostname = `${https}://${urlStr}`;

  if (obj) {
    obj.hostname = hostname;
  }

  validate(hostname, obj);
};
/** 驗證api */
const validate = async (url, obj) => {
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
    /** 安全可執行連結網址 */
    if (response.valid && obj) {
      checkComplete(response.valid, obj);
    }

    console.log(url);
    console.log(obj);
    console.log(checkObj);
    // false 為黑名單
    if (!response.valid) {
      changeRule(url);
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs[0].id && !isErrorPage) {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ["scripts/srcipt.js"],
          });
        }
      });
    }
  } catch (error) {
    console.log(error);
  }
};

/** 點擊連結檢查安全 */
const checkComplete = (obj) => {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs && tabs[0].id) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { isCheck: true, obj },
        (response) => {
          console.log(response);
        }
      );
    }
  });
};

/** 監聽content傳過來訊息 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(message);
  if (message.check) {
    checkUrl(message.href, message);
    checkObj = message;
    isCheck = true;
    sendResponse("ok");
    return;
  }
  console.log({ isCheck });
  if (isCheck) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      console.log(tabs);
      if (tabs && tabs[0].id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { isCheck: message.confirm, obj: checkObj },
          (response) => {
            console.log(response);
          }
        );
      }
    });
  }
  // const hostname = !isCheck ? message.hostname : checkObj.hostname;
  const hostname = message.hostname;
  if (message.confirm) {
    changeRule(hostname, "allow");
  }
  if (!message.confirm) {
    changeRule(hostname, "block");
  }

  sendResponse("ok");
});

// const checkFunc = (url) => {
//   console.log(url);
// };

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
  if (checkObj) {
    oldRule = {
      ...oldRule,
      condition: {
        urlFilter: checkObj.hostname,
        resourceTypes: oldRule.condition.resourceTypes,
      },
    };
  }
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
      // id: getDynamicRules[getDynamicRules.length - 1].id + 1,
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
    // const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
    // const oldRuleIds = oldRules.map((rule) => rule.id);
    await chrome.declarativeNetRequest.updateDynamicRules({
      // removeRuleIds: oldRuleIds,
      addRules: newRules,
      removeRuleIds: [id],
    });
  }
}

// chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((e) => {
//   const msg = `Navigation to ${e.request.url} redirected on tab ${e.request.tabId}.`;
//   console.log(msg);
// });

/**發送訊息至content */
async function sendMsgToContentScript() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    // chrome.tabs.sendMessage(tabs[0].id, { message: url }, (response) => {
    //   console.log(response);
    // });
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ["scripts/reload.js"],
      // function: reddenPage,
      // args: [url],
    });
  });
}
const reddenPage = () => {
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(
      () => () => {
        location.href = location.href;
      },
      [1000]
    );
  });
};
/** 取得目前分頁 */
async function getCurrentTab() {
  const queryOptions = { active: true, lastFocusedWindow: true };
  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  const [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}
