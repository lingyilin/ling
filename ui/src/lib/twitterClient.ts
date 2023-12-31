import { Client, auth } from "twitter-api-sdk";
import { TWITTER_CLIENT_ID } from "./constants";

let authClient: auth.OAuth2User | null;
let client: Client | null;

export function GetClients(redirectBaseUrl: string | undefined = undefined): { client: Client, authClient: auth.OAuth2User } {
    authClient = new auth.OAuth2User({
        client_id: TWITTER_CLIENT_ID as string,
        callback: `${redirectBaseUrl ?? window.location.origin}/salon`,
        scopes: ["tweet.read", "users.read", "offline.access"],
    });

    client = new Client(authClient);

    return { client, authClient };
}