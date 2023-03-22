/**
 * @name MessageLogger
 * @author Clementine
 * @version 1.0.6
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

    const fs = require("fs");
    const path = require("path");
    const configFile = path.join(BdApi.Plugins.folder, "MessageLogger.config.json");

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
        this.selectedGuilds = {};
        if (fs.existsSync(configFile)) {
          try {
            const configContent = JSON.parse(fs.readFileSync(configFile, "utf8"));
            this.selectedGuilds = configContent.all.selectedGuilds;
          } catch (err) {
            console.error(`Failed to read config file: ${err}`);
          }
        } else {
          console.warn("Config file not found. No servers will be selected for logging.");
        }
        console.log("Selected Guilds:", this.selectedGuilds);
        BDFDB.PatchUtils.patch(this, BDFDB.LibraryModules.DispatchApiUtils, "dispatch", {
          after: e => {
            let action = e.methodArguments[0];

            // Handling MESSAGE_CREATE
            if (BDFDB.ObjectUtils.is(action) && action.type == "MESSAGE_CREATE" && action.message) {
              let message = action.message;
              let channelId = message.channel_id;

              if (channelId) {
                // Initialize edit_history for the message
                message.edit_history = [];
                this.messageCache.set(message.id, message);
              }
            }

            // Handling MESSAGE_DELETE
            if (BDFDB.ObjectUtils.is(action) && action.type == "MESSAGE_DELETE" && action.id) {
              let deletedMessage = this.messageCache.get(action.id);
              if (deletedMessage) {
                let channel = BDFDB.LibraryStores.ChannelStore.getChannel(deletedMessage.channel_id);
                let guildId = channel && channel.guild_id ? channel.guild_id : deletedMessage.channel_id;

                // Get the recipient ID if the channel is a DM
                let recipientId = null;
                if (channel && channel.isDM()) {
                  recipientId = channel.recipients[0];
                }

                // Use the latest content of the message for logging
                const messageContent = deletedMessage.edit_history.length > 0 ? deletedMessage.edit_history[deletedMessage.edit_history.length - 1].content : deletedMessage.content;
                const modifiedMessage = { ...deletedMessage, content: messageContent };
                this.saveMessageToFile(guildId, modifiedMessage, recipientId);
                this.messageCache.delete(action.id);
              }
            }

            // Handling MESSAGE_UPDATE
            if (BDFDB.ObjectUtils.is(action) && action.type == "MESSAGE_UPDATE" && action.message) {
              let message = action.message;
              let originalMessage = this.messageCache.get(message.id);

              if (originalMessage) {
                let channel = BDFDB.LibraryStores.ChannelStore.getChannel(message.channel_id);
                let guildId = channel && channel.guild_id ? channel.guild_id : message.channel_id;

                // Get the recipient ID if the channel is a DM
                let recipientId = null;
                if (channel && channel.isDM()) {
                  recipientId = channel.recipients[0];
                }

                // Append the new edit to the edit history of the message
                originalMessage.edit_history.push({
                  content: message.content,
                  edited_timestamp: message.edited_timestamp
                });
/*
                // Fetch and cache recent messages in selected server channels
                this.fetchAndCacheRecentMessagesInSelectedGuilds();

                // Fetch and cache recent messages in DMs
                this.fetchAndCacheDMs();
*/
                this.saveEditedMessageToFile(guildId, message, recipientId, originalMessage);
                this.messageCache.set(message.id, originalMessage); // Update the message cache with the latest edit
              }
            }
          }
        });
      }

      onStop() {
        // Code that runs when the plugin is stopped
      }
      
/*
      async fetchAndCacheRecentMessages(channelId, fetchLimit) {
        try {
          // Wait for 2 seconds (2000 milliseconds) before making a request
          await new Promise(resolve => setTimeout(resolve, 2000));

          const response = await BDFDB.LibraryModules.MessageAPI.fetchMessages(channelId, { limit: fetchLimit });
          const messages = response.messages;
          for (const message of messages) {
            message.edit_history = [];
            this.messageCache.set(message.id, message);
          }
        } catch (error) {
          console.error(`Failed to fetch messages for channel ${channelId}:`, error);
        }
      }

      async fetchAndCacheRecentMessagesInSelectedGuilds() {
        const fetchLimit = 50; // Fetch up to 50 recent messages
      
        for (const guildId in this.selectedGuilds) {
          const channels = BDFDB.LibraryStores.ChannelStore.getChannels(guildId);
          for (const channelId in channels) {
            const channel = channels[channelId];
            if (channel.type === 0) { // Check if it's a text channel
              await this.fetchAndCacheRecentMessages(channel.id, fetchLimit);
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds (2000 milliseconds) before fetching the next channel
            }
          }
        }
      }
      
      async fetchAndCacheDMs() {
        const privateChannels = BDFDB.LibraryStores.PrivateChannelStore.getPrivateChannels();
        const fetchLimit = 50; // Fetch up to 50 recent messages
      
        for (const privateChannel of Object.values(privateChannels)) {
          if (privateChannel.isDM()) {
            await this.fetchAndCacheRecentMessages(privateChannel.id, fetchLimit);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds (2000 milliseconds) before fetching the next DM
          }
        }
      }
*/

      saveMessageToFile(guildId, message, recipient = null) {
        const fs = require("fs");
        const path = require("path");
        const logFilePath = path.join(this.logDirectory, "deleted_messages.txt");

        // Fetch the channel object from the ChannelStore
        const channel = BDFDB.LibraryStores.ChannelStore.getChannel(message.channel_id);

        // Check if the channel is a DM
        const isDM = channel && channel.isDM();
        const isSelectedServer = this.selectedGuilds[guildId] === true;

        // Only log messages from specified guilds or DMs
        if (isDM || isSelectedServer) {
          // Get the server (guild) name
          const guild = BDFDB.LibraryStores.GuildStore.getGuild(guildId);
          const serverName = guild ? guild.name : "DM";

          // Get the recipient's user object
          const recipientUser = recipient ? BDFDB.LibraryStores.UserStore.getUser(recipient) : null;

          // Use [DM] tag for DMs with the recipient's username and guild name tag for guilds
          const tag = isDM && recipientUser ? `[DM: ${recipientUser.username}#${recipientUser.discriminator}]` : `[${serverName}]`;

          const logMessage = `[${new Date(message.timestamp).toISOString()}] ${tag} ${message.author.username}#${message.author.discriminator}: ${message.content}\n`;

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
      }

      saveEditedMessageToFile(guildId, message, recipient = null, originalMessage) {
        const fs = require("fs");
        const path = require("path");
        const logFilePath = path.join(this.logDirectory, "edited_messages.txt");

        // Fetch the channel object from the ChannelStore
        const channel = BDFDB.LibraryStores.ChannelStore.getChannel(message.channel_id);

        // Check if the channel is a DM
        const isDM = channel && channel.isDM();
        const isSelectedServer = this.selectedGuilds[guildId] === true;

        // Only log messages from specified guilds or DMs
        if (isDM || isSelectedServer) {
          // Get the server (guild) name
          const guild = BDFDB.LibraryStores.GuildStore.getGuild(guildId);
          const serverName = guild ? guild.name : "DM";

          // Get the recipient's user object
          const recipientUser = recipient ? BDFDB.LibraryStores.UserStore.getUser(recipient) : null;

          // Use [DM] tag for DMs with the recipient's username and guild name tag for guilds
          const tag = isDM && recipientUser ? `[DM: ${recipientUser.username}#${recipientUser.discriminator}]` : `[${serverName}]`;

          // Generate the edit history string
          const editHistory = [originalMessage.content, ...originalMessage.edit_history.map(edit => edit.content)].join(" -> ");

          const logMessage = `[${new Date(message.edited_timestamp).toISOString()}] ${tag} ${message.author.username}#${message.author.discriminator}: ${editHistory}\n`;

          fs.readFile(logFilePath, 'utf8', (err, data) => {
            if (err && err.code === 'ENOENT') {
              // If the file doesn't exist, create it with the logMessage
              fs.writeFile(logFilePath, logMessage, (writeErr) => {
                if (writeErr) {
                  console.error(`Failed to save edited message to file: ${writeErr}`);
                }
              });
            } else if (!err) {
              // If the file exists, append the logMessage to the existing content
              const updatedContent = data + logMessage;
              fs.writeFile(logFilePath, updatedContent, (writeErr) => {
                if (writeErr) {
                  console.error(`Failed to save edited message to file: ${writeErr}`);
                }
              });
            } else {
              console.error(`Failed to read the file: ${err}`);
            }
          });
        }
      }

      // Other custom methods and functionality

    };
  })(window.BDFDB_Global.PluginUtils.buildPlugin({}));
})();