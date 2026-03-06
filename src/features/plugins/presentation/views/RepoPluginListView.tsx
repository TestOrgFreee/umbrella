import React, { useEffect, useState } from 'react';
import {
    Alert,
    BackHandler,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import {
    ActivityIndicator,
    Button,
    Divider,
    Icon,
    IconButton,
    List,
    Snackbar,
    Text,
    useTheme,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { PluginRepo, PluginRepoEntry } from '../../domain/entities/PluginRepo';
import { Plugin } from '../../domain/entities/Plugin';
import { PluginViewModel } from '../viewmodels/PluginsViewModel';
import { useInstallPluginDialogStore } from '../state/useInstallPluginDialogStore';
import { useBottomNavigationBarState } from '../../../../navigation/useBottomNavigationBarState';
import { useRepoStore } from '../state/useRepoStore';
import RepoPluginListItem from '../components/RepoPluginListItem';
import SourceType from '../../data/model/source/SourceType';

interface RepoPluginListViewProps {
    route?: {
        params?: {
            repoUrl: string;
        };
    };
}

// RepoPluginListView
// Full-screen view listing all plugins from a plugin repository.
// Opened when user adds a repository URL — like CloudStream's repo view.
const RepoPluginListView = ({ route }: RepoPluginListViewProps) => {
    const repoUrl = route?.params?.repoUrl ?? '';
    const theme = useTheme();
    const navigation = useNavigation();
    const { setVisible: setNavVisible } = useBottomNavigationBarState();

    const [repo, setRepo] = useState<PluginRepo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [installingPlugin, setInstallingPlugin] = useState<string | null>(null);
    const [snackMessage, setSnackMessage] = useState('');
    const [snackVisible, setSnackVisible] = useState(false);

    const { addRepo, hasRepo } = useRepoStore(state => state);
    const pluginViewModel = new PluginViewModel();

    const {
        setVisible: setInstallVisible,
        setLoading: setInstallLoading,
        setPlugin,
        setWaitingForPlugins,
        setOnConfirm: setInstallOnConfirm,
    } = useInstallPluginDialogStore(state => state);

    // Hide bottom nav when entering this view
    useEffect(() => {
        setNavVisible(false);
        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                setNavVisible(true);
                navigation.goBack();
                return true;
            },
        );
        return () => backHandler.remove();
    }, []);

    // Load the repository
    useEffect(() => {
        if (!repoUrl) {
            setError('No repository URL provided');
            setLoading(false);
            return;
        }
        loadRepo();
    }, [repoUrl]);

    const loadRepo = async () => {
        setLoading(true);
        setError(null);
        const result = await pluginViewModel.fetchRepository(repoUrl);
        setLoading(false);
        if (result.status === 'success') {
            setRepo(result.data);
            // Save repo to store if not already saved
            if (!hasRepo(repoUrl)) {
                addRepo({
                    url: repoUrl,
                    name: result.data.name,
                    author: result.data.author,
                    description: result.data.description,
                    pluginCount: result.data.plugins.length,
                });
            }
        } else if (result.status === 'error') {
            setError((result as any).error ?? 'Failed to load repository');
        }
    };

    // Convert a PluginRepoEntry to the Plugin shape for the install dialog
    const entryToPlugin = (entry: PluginRepoEntry): Plugin => ({
        name: entry.name,
        author: entry.author ?? repo?.author ?? '',
        version: entry.version,
        description: entry.description,
        homePageUrl: entry.homePageUrl,
        iconUrl: entry.iconUrl,
        bannerImageUrl: entry.bannerImageUrl,
        manifestUrl: entry.manifestUrl,
        pluginUrl: entry.pluginUrl,
        changelog: entry.changelog,
        readme: entry.readme,
        license: entry.license,
        sourceType: entry.sourceType as SourceType,
    });

    const handleInstallPlugin = async (entry: PluginRepoEntry) => {
        const plugin = entryToPlugin(entry);
        setInstallingPlugin(entry.name);
        setInstallVisible(true);
        setInstallLoading(true);
        setWaitingForPlugins(true);
        setPlugin(undefined);

        // Fetch the manifest for this entry
        const manifestResult = await pluginViewModel.fetchManifest(entry.manifestUrl);
        setInstallLoading(false);

        if (manifestResult.status === 'success') {
            setPlugin(manifestResult.data);
            setWaitingForPlugins(false);
            setInstallVisible(true);
            setInstallOnConfirm(async () => {
                const fetchResult = await pluginViewModel.fetchPlugin(manifestResult.data);
                setInstallingPlugin(null);
                if (fetchResult.status === 'success') {
                    setSnackMessage(`\u2705 ${fetchResult.data.name} installed`);
                    setSnackVisible(true);
                    pluginViewModel.loadAllPluginsFromStorage();
                } else if (fetchResult.status === 'error') {
                    Alert.alert('Installation failed', (fetchResult as any).error ?? 'Unknown error');
                }
            });
        } else {
            setInstallingPlugin(null);
            setInstallVisible(false);
            Alert.alert('Failed to fetch manifest', (manifestResult as any).error ?? 'Unknown error');
        }
    };

    const handleInstallAll = async () => {
        if (!repo) return;
        const uninstalled = repo.plugins.filter(
            entry =>
                !useRepoStore.getState().hasRepo(entry.name),
        );
        Alert.alert(
            'Install All',
            `Install all ${repo.plugins.length} plugins from this repository?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Install All',
                    onPress: async () => {
                        for (const entry of repo.plugins) {
                            await handleInstallPlugin(entry);
                        }
                    },
                },
            ],
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <IconButton
                    icon="arrow-left"
                    onPress={() => {
                        setNavVisible(true);
                        navigation.goBack();
                    }}
                />
                <View style={styles.headerTitleContainer}>
                    <Icon source="package-variant" size={24} />
                    <Text variant="titleLarge" style={styles.headerTitle} numberOfLines={1}>
                        {loading ? 'Loading Repository...' : repo?.name ?? 'Repository'}
                    </Text>
                </View>
            </View>

            {loading && (
                <View style={styles.center}>
                    <ActivityIndicator size="large" />
                    <Text style={{ marginTop: 16, opacity: 0.6 }}>Fetching repository...</Text>
                </View>
            )}

            {!loading && error && (
                <View style={styles.center}>
                    <Icon source="alert-circle-outline" size={48} />
                    <Text style={{ marginTop: 12, color: 'red', textAlign: 'center' }}>
                        {error}
                    </Text>
                    <Button style={{ marginTop: 16 }} mode="outlined" onPress={loadRepo}>
                        Retry
                    </Button>
                </View>
            )}

            {!loading && repo && (
                <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
                    {/* Repo info banner */}
                    <View
                        style={[
                            styles.repoInfoCard,
                            { backgroundColor: theme.colors.surfaceVariant },
                        ]}>
                        <Text variant="bodyLarge" style={styles.repoAuthor}>
                            by {repo.author}
                        </Text>
                        {repo.description ? (
                            <Text variant="bodyMedium" style={styles.repoDescription}>
                                {repo.description}
                            </Text>
                        ) : null}
                        <Text variant="bodySmall" style={styles.repoMeta}>
                            {repo.plugins.length} plugin{repo.plugins.length !== 1 ? 's' : ''}
                            {' • '}
                            {repoUrl}
                        </Text>

                        <Button
                            mode="contained"
                            style={styles.installAllButton}
                            icon="download-multiple"
                            onPress={handleInstallAll}>
                            Install All
                        </Button>
                    </View>

                    <Divider />

                    {/* Plugin list */}
                    <List.Section>
                        <List.Subheader>Available Plugins</List.Subheader>
                        {repo.plugins.map(entry => (
                            <View key={entry.name}>
                                <RepoPluginListItem
                                    entry={entry}
                                    onInstall={handleInstallPlugin}
                                />
                                <Divider />
                            </View>
                        ))}
                    </List.Section>
                </ScrollView>
            )}

            <Snackbar
                visible={snackVisible}
                duration={2500}
                onDismiss={() => setSnackVisible(false)}
                style={styles.snackbar}>
                {snackMessage}
            </Snackbar>
        </View>
    );
};

export default RepoPluginListView;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 16,
        paddingBottom: 4,
    },
    headerTitleContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        flex: 1,
        fontWeight: 'bold',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    repoInfoCard: {
        margin: 12,
        padding: 16,
        borderRadius: 12,
    },
    repoAuthor: {
        opacity: 0.7,
        marginBottom: 4,
    },
    repoDescription: {
        marginBottom: 8,
    },
    repoMeta: {
        opacity: 0.5,
        fontSize: 11,
        marginBottom: 12,
    },
    installAllButton: {
        alignSelf: 'flex-start',
    },
    snackbar: {
        position: 'absolute',
        bottom: 80,
        left: 0,
        right: 0,
    },
});
