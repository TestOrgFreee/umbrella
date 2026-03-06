import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Icon, List, Text } from 'react-native-paper';
import { PluginRepoEntry } from '../../domain/entities/PluginRepo';
import { usePluginStore } from '../state/usePluginStore';
import LazyImage from '../../../../core/shared/components/LazyImage';

interface RepoPluginListItemProps {
    entry: PluginRepoEntry;
    onInstall: (entry: PluginRepoEntry) => void;
}

// RepoPluginListItem
// Renders a single plugin entry from a repository with install/installed state
const RepoPluginListItem = ({ entry, onInstall }: RepoPluginListItemProps) => {
    const { plugins } = usePluginStore(state => state);

    // Check if this plugin is already installed (match by name)
    const installedPlugin = plugins.find(p => p.name === entry.name);
    const isInstalled = installedPlugin !== undefined;
    const hasUpdate =
        isInstalled && installedPlugin.version < entry.version;

    return (
        <List.Item
            title={entry.name}
            description={entry.description}
            titleStyle={styles.title}
            descriptionStyle={styles.description}
            descriptionNumberOfLines={2}
            left={_props =>
                entry.iconUrl ? (
                    <LazyImage
                        src={entry.iconUrl}
                        placeholderSource="circle"
                        style={styles.icon}
                    />
                ) : (
                    <View style={styles.iconPlaceholder}>
                        <Icon source="power-plug" size={28} />
                    </View>
                )
            }
            right={_props => (
                <View style={styles.rightContainer}>
                    {hasUpdate ? (
                        <Button
                            mode="contained"
                            compact
                            style={styles.updateButton}
                            labelStyle={styles.buttonLabel}
                            onPress={() => onInstall(entry)}>
                            Update
                        </Button>
                    ) : isInstalled ? (
                        <Chip
                            icon="check-circle"
                            compact
                            style={styles.installedChip}
                            textStyle={styles.chipText}>
                            Installed
                        </Chip>
                    ) : (
                        <Button
                            mode="outlined"
                            compact
                            style={styles.installButton}
                            labelStyle={styles.buttonLabel}
                            onPress={() => onInstall(entry)}>
                            Install
                        </Button>
                    )}
                </View>
            )}
        />
    );
};

export default RepoPluginListItem;

const styles = StyleSheet.create({
    title: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    description: {
        fontSize: 12,
        opacity: 0.7,
    },
    icon: {
        width: 48,
        height: 48,
        borderRadius: 8,
        marginLeft: 8,
        alignSelf: 'center',
    },
    iconPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: '#444',
        marginLeft: 8,
        alignSelf: 'center',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rightContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 4,
    },
    installButton: {
        minWidth: 80,
    },
    updateButton: {
        minWidth: 80,
        backgroundColor: '#ff8c00',
    },
    installedChip: {
        height: 30,
    },
    buttonLabel: {
        fontSize: 12,
    },
    chipText: {
        fontSize: 11,
    },
});
