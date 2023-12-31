export type AccessTokenData = {
    refreshToken: string | undefined,
    token: string | undefined,
    userName: string | undefined,
    profile_image_url: string | undefined
}

export type GetAccessTokenData = (AccessTokenData & { isError: false }) | { error: string, isError: true };
