//content.js

const handleClick = (e) => {
  // e.preventDefault();
  console.log(e);
  console.log(e.target);
  console.log(e.target.href);
  console.log(e.target.tagName);
  console.log(e.target.target);
  const el = e.target;
  if (el.tagName === "A" && el.target === "") {
    e.preventDefault();
    chrome.runtime.sendMessage(
      {
        check: true,
        href: e.target.href,
        target: "_self",
      },
      (response) => {
        console.log("received user data", response);
      }
    );
  }
};

document.addEventListener("click", handleClick);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(message);
  sendResponse("ok");
  if (message.isCheck) {
    window.open(message.obj.href, message.obj.target);
  }
});
