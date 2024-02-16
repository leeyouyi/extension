if (!window.confirm("你所選擇的網站不安全,要繼續嗎?")) {
  chrome.runtime.sendMessage(
    {
      confirm: false,
      hostname: location.hostname,
      href: location.href,
    },
    (response) => {
      console.log("received user data", response);
    }
  );
} else {
  chrome.runtime.sendMessage(
    {
      confirm: true,
      hostname: location.hostname,
      href: location.href,
    },
    (response) => {
      console.log("received user data", response);
    }
  );
}
