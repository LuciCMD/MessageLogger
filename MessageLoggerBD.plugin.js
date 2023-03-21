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

    return class MessageLogger extends Plugin {
      onLoad() {
        this.messageHistory = [];
        this.messageCache = new Map();
        this.logDirectory = require("path").join(BdApi.Plugins.folder, "MessageLogs");
        if (!require("fs").existsSync(this.logDirectory)) {
          require("fs").mkdirSync(this.logDirectory);
        }
      }

      onStart() {
        BDFDB.PatchUtils.patch(this, BDFDB.LibraryModules.DispatchApiUtils, "dispatch", {
          after: e => {
            let action = e.methodArguments[0];

            // Handling MESSAGE_CREATE
            if (BDFDB.ObjectUtils.is(action) && action.type == "MESSAGE_CREATE" && action.message) {
              let message = action.message;
              let channelId = message.channel_id;

              if (channelId) {
                this.messageCache.set(message.id, message);
              }
            }

            // Handling MESSAGE_DELETE
            if (BDFDB.ObjectUtils.is(action) && action.type == "MESSAGE_DELETE" && action.id) {
              let message = this.messageCache.get(action.id);

              if (message) {
                let guildId = message.guild_id || message.channel_id;
                this.saveMessageToFile(guildId, message);
                this.messageCache.delete(action.id);
              }
            }
          }
        });
      }

      onStop() {
        // Code that runs when the plugin is stopped
      }

      saveMessageToFile(guildId, message) {
        const fs = require("fs");
        const path = require("path");
        const logFilePath = path.join(this.logDirectory, "deleted_messages.txt");
      
        // Get the server (guild) name
        const guild = BDFDB.LibraryStores.GuildStore.getGuild(guildId);
        const serverName = guild ? guild.name : "DM";
      
        const logMessage = `[${new Date(message.timestamp).toISOString()}] [${serverName}] ${message.author.username}#${message.author.discriminator}: ${message.content}\n`;
      
        fs.readFile(logFilePath, 'utf8', (err, data) => {
          if (err && err.code === 'ENOENT') {
            // If the file doesn't exist, create it with the logMessage
            fs.writeFile(logFilePath, logMessage, (writeErr) => {
              if (writeErr) {
                console.error(`Failed to save message to file: ${writeErr}`);
              }
            });
          } else if (!err) {
            // If the file exists, append the logMessage to the existing content
            const updatedContent = data + logMessage;
            fs.writeFile(logFilePath, updatedContent, (writeErr) => {
              if (writeErr) {
                console.error(`Failed to save message to file: ${writeErr}`);
              }
            });
          } else {
            console.error(`Failed to read the file: ${err}`);
          }
        });
      }      
      

      // Other custom methods and functionality

    };
  })(window.BDFDB_Global.PluginUtils.buildPlugin({}));
})();