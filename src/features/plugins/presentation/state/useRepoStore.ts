import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Saved repository entry — a URL that the user has added
export interface SavedRepo {
    url: string;
    name: string;
    author: string;
    description?: string;
    pluginCount: number;
}

// Repository store
// Persists a list of repository URLs the user has added,
// similar to CloudStream's repo list.
interface RepoStoreState {
    repos: SavedRepo[];
    addRepo: (repo: SavedRepo) => void;
    removeRepo: (url: string) => void;
    hasRepo: (url: string) => boolean;
}

export const useRepoStore = create(
    persist<RepoStoreState>(
        (set, get) => ({
            repos: [],
            addRepo: repo =>
                set(state => {
                    // Don't add duplicates
                    if (state.repos.some(r => r.url === repo.url)) {
                        return state;
                    }
                    return { repos: [...state.repos, repo] };
                }),
            removeRepo: url =>
                set(state => ({ repos: state.repos.filter(r => r.url !== url) })),
            hasRepo: url => get().repos.some(r => r.url === url),
        }),
        {
            name: 'plugin-repos',
            storage: createJSONStorage(() => AsyncStorage),
            version: 0,
        },
    ),
);
