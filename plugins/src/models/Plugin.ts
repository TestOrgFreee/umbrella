import SourceType from './source/SourceType';

export interface Plugin {
    sourceType: SourceType;
    author?: string;
    name: string;
    version: number;
    description?: string;
    homePageUrl?: string;
    iconUrl?: string;
    manifestPath?: string;
    manifestUrl?: string;
    pluginPath?: string;
    pluginUrl: string;
    bannerImageUrl?: string;
    changelog?: string;
    readme?: string;
    license?: string;
}
