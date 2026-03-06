import Status from '../../../../core/shared/types/Status';
import { PluginRepo } from '../entities/PluginRepo';
import { PluginRepository } from '../repositories/PluginRepository';

// Fetch repository usecase
// This is the usecase for fetching a plugin repository
// containing multiple plugins from a single URL
export class FetchRepositoryUsecase {
    constructor(private pluginRepository: PluginRepository) { }

    async execute(url: string): Promise<Status<PluginRepo>> {
        return this.pluginRepository.fetchRepository(url);
    }
}
