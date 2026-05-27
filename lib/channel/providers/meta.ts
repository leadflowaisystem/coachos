/**
 * Meta (Instagram Graph API) channel — STUB.
 *
 * Uses the official Instagram Business + Messenger Platform APIs.
 * Requires Meta App review and a connected Instagram Business account.
 *
 * Real implementation will:
 *   - Register a webhook for `messages` & `messaging_postbacks`
 *   - Call Graph API POST /me/messages to send DMs
 *   - Verify webhook signatures with the app secret
 *
 * Until `isLive` is set to true, the UI shows a "Coming soon" badge.
 */

import type { ChannelProvider, ChannelMessage, SendMessageArgs } from "../types";

export const metaProvider: ChannelProvider = {
  id: "meta",
  name: "Meta (Instagram API)",
  description:
    "Connect directly via the official Instagram Business API. Requires a verified Meta App and Instagram Business account.",
  logoInitials: "IG",
  requiresSetup: true,
  isLive: false, // flip to true when OAuth + webhook is wired

  validateConfig(config) {
    if (!config.page_access_token_enc || typeof config.page_access_token_enc !== "string") {
      return "Instagram Page Access Token is required.";
    }
    if (!config.app_secret_enc || typeof config.app_secret_enc !== "string") {
      return "Meta App Secret is required.";
    }
    return null;
  },

  async fetchInbound(_orgId, _config): Promise<ChannelMessage[]> {
    // STUB — will be driven by webhook events, not polling
    throw new Error("Meta Instagram integration is not yet live.");
  },

  async send(_orgId, _config, _args: SendMessageArgs): Promise<void> {
    // STUB — will call Graph API
    throw new Error("Meta Instagram integration is not yet live.");
  },
};
