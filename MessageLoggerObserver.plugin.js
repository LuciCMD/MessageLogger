/**
 * @name MessageLogger
 * @author Clementine
 * @version 1.0.0
 * @description Logs all messages in a channel and saves them to a file when deleted.
 * @website https://github.com/LuciCMD/MessageLogger
 * @source https://github.com/LuciCMD/MessageLogger/blob/main/MessageLogger.plugin.js
 * @updateUrl https://raw.githubusercontent.com/LuciCMD/MessageLogger/main/MessageLogger.plugin.js
 */

module.exports = (_ => {

  return !window.BDFDB_Global || (!window.BDFDB_Global.loaded && !window.BDFDB_Global.started) ? class {
    constructor(meta) { for (let key in meta) this[key] = meta[key]; }
    getName() { return this.name; }
    getAuthor() { return this.author; }
    getVersion() { return this.version; }
    getDescription() { return `The Library Plugin needed for ${this.name} is missing. Open the Plugin Settings to download it. \n\n${this.description}`; }

    downloadLibrary() {
      require("request").get("https://mwittrien.github.io/BetterDiscordAddons/Library/0BDFDB.plugin.js", (e, r, b) => {
        if (!e && b && r.statusCode == 200) require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0BDFDB.plugin.js"), b, _ => BdApi.showToast("Finished downloading BDFDB Library", { type: "success" }));
        else BdApi.alert("Error", "Could not download BDFDB Library Plugin. Try again later or download it manually from GitHub: https://mwittrien.github.io/downloader/?library");
      });
    }

    load() {
      if (!window.BDFDB_Global || !Array.isArray(window.BDFDB_Global.pluginQueue)) window.BDFDB_Global = Object.assign({}, window.BDFDB_Global, { pluginQueue: [] });
      if (!window.BDFDB_Global.downloadModal) {
        window.BDFDB_Global.downloadModal = true;
        BdApi.showConfirmationModal("Library Missing", `The Library Plugin needed for ${this.name} is missing. Please click "Download Now" to install it.`, {
          confirmText: "Download Now",
          cancelText: "Cancel",
          onCancel: _ => { delete window.BDFDB_Global.downloadModal; },
          onConfirm: _ => {
            delete window.BDFDB_Global.downloadModal;
            this.downloadLibrary();
          }
        });
      }
      if (!window.BDFDB_Global.pluginQueue.includes(this.name)) window.BDFDB_Global.pluginQueue.push(this.name);
    }

    start() { this.load(); }

    stop() { }

    getSettingsPanel() {
      let template = document.createElement("template");
      template.innerHTML = `<div style="color: var(--header-primary); font-size: 16px; font-weight: 300; white-space: pre; line-height: 22px;">The Library Plugin needed for ${this.name} is missing.\nPlease click <a style="font-weight: 500;">Download Now</a> to install it.</div>`;
      template.content.firstElementChild.querySelector("a").addEventListener("click", this.downloadLibrary);
      return template.content.firstElementChild;
    }

  } : (([Plugin, BDFDB]) => {
    // Your custom plugin functionality using BDFDB library

    return class MessageLogger extends Plugin {
      onLoad() {
        this.messageHistory = [];
      }

      onStart() {
        // Code that runs when the plugin is started
      }

      onStop() {
        // Code that runs when the plugin is stopped
      }

      // Other custom methods and functionality
      attachObserver() {
        const messageContainer = document.querySelector('.scrollerBase-289Jih');
        if (messageContainer) {
          this.observer = new MutationObserver(this.handleMutations.bind(this));
          this.observer.observe(messageContainer, { childList: true, subtree: true });
        } else {
          setTimeout(() => this.attachObserver(), 1000);
        }
      }

      handleMutations(mutations) {
        for (const mutation of mutations) {
          if (mutation.addedNodes.length > 0) {
            const lastMessage = document.querySelector('.scrollerBase-289Jih .message-2qnXI6:last-child');
            if (lastMessage) {
              const messageContent = lastMessage.querySelector('.markup-2BOw-j');
              if (messageContent) {
                console.log('Last message:', messageContent.textContent);
              }
            }
          }
        }
      }

    };
  })(window.BDFDB_Global.PluginUtils.buildPlugin({}));
})();