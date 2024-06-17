import type { SdkConfiguration, ICachingStrategy, AccessToken } from "../types.js";
import AccessTokenHelpers from "./AccessTokenHelpers.js";
import IAuthStrategy from "./IAuthStrategy.js";

export default class RefreshTokenStrategy implements IAuthStrategy {

    private static readonly cacheKey = "spotify-sdk:RefreshTokenStrategy:token";
    private configuration: SdkConfiguration | null = null;
    private get cache(): ICachingStrategy { return this.configuration!.cachingStrategy; }

    constructor(
        private clientId: string,
        private clientSecret: string,
        private refreshToken: string,
    ) {
    }

    public setConfiguration(configuration: SdkConfiguration): void {
        this.configuration = configuration;
    }

    public async getOrCreateAccessToken(): Promise<AccessToken> {
        const token = await this.cache.getOrCreate<AccessToken>(
            RefreshTokenStrategy.cacheKey,
            async () => {
                const token = await this.getTokenFromApi();
                return AccessTokenHelpers.toCachable(token);
            },
            async (_) => {
                const refreshed = await this.getTokenFromApi();
                return AccessTokenHelpers.toCachable(refreshed);
            }
        );

        return token;
    }

    public async getAccessToken(): Promise<AccessToken | null> {
        const token = await this.cache.get<AccessToken>(RefreshTokenStrategy.cacheKey);
        return token;
    }

    public removeAccessToken(): void {
        this.cache.remove(RefreshTokenStrategy.cacheKey);
    }

    private async getTokenFromApi(): Promise<AccessToken> {
        const body =  new URLSearchParams({
            grant_type: "refresh_token",
            client_id: this.clientId,
            refresh_token: this.refreshToken,
          });

        const hasBuffer = typeof Buffer !== 'undefined';
        const credentials = `${this.clientId}:${this.clientSecret}`;

        const basicAuth = hasBuffer
            ? Buffer.from(credentials).toString('base64')
            : btoa(credentials);

        const result = await fetch("https://accounts.spotify.com/api/token", {
            method: 'POST',
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `Basic ${basicAuth}`
            },
            body: body,
        });

        if (result.status !== 200) {
            throw new Error("Failed to get access token: " + await result.text());
        }

        const json = await result.json();
        return json;
    }
}
