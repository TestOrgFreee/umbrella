// PluginRepo
// Represents a plugin repository that contains multiple plugins
// Similar to CloudStream's extension repository format

export interface PluginRepoEntry {
    manifestUrl: string;
    pluginUrl: string;
    name: string;
    version: number;
    description?: string;
    iconUrl?: string;
    sourceType: string;
    author?: string;
    homePageUrl?: string;
    bannerImageUrl?: string;
    changelog?: string;
    readme?: string;
    license?: string;
}

export interface PluginRepo {
    name: string;
    author: string;
    description?: string;
    plugins: PluginRepoEntry[];
}
