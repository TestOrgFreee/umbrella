import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, StyleSheet, View } from 'react-native';
import {
  Text,
  Button,
  Dialog,
  FAB,
  Portal,
  useTheme,
  TextInput,
  List,
  IconButton,
  Divider,
} from 'react-native-paper';
import { usePluginStore } from '../state/usePluginStore';
import PluginList from '../components/PluginList';
import ConfirmOrDenyDialog from '../../../../core/shared/components/dialogs/ConfirmOrDenyDialog';
import { useInstallPluginDialogStore } from '../state/useInstallPluginDialogStore';
import { PluginViewModel } from '../viewmodels/PluginsViewModel';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRepoStore } from '../state/useRepoStore';

type RootStackParamList = {
  repoPluginListView: { repoUrl: string };
};

// Smart Add Plugin Dialog
// Accepts both single manifest URLs (.json) AND repository URLs
// Auto-detects which type by trying to parse the response
const AddPluginDialog = ({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    setVisible: setInstallVisible,
    setLoading: setInstallDialogLoading,
    setPlugin,
    setWaitingForPlugins,
    setOnConfirm: setInstallOnConfirm,
  } = useInstallPluginDialogStore(state => state);

  const pluginViewModel = new PluginViewModel();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleAdd = async () => {
    if (!url.startsWith('http')) {
      Alert.alert('Invalid URL', 'Please enter a URL starting with http:// or https://');
      return;
    }

    onDismiss();
    setLoading(true);

    try {
      // Fetch the URL and peek at what it is
      const response = await fetch(url);
      if (!response.ok) {
        Alert.alert('Error', `Could not reach URL: ${response.statusText}`);
        setLoading(false);
        return;
      }

      const json = await response.json();

      if (Array.isArray(json.plugins)) {
        // ✅ It's a REPOSITORY — navigate to repo plugin list view
        setLoading(false);
        navigation.navigate('repoPluginListView', { repoUrl: url });
      } else if (json.pluginUrl && json.name) {
        // ✅ It's a single MANIFEST — use existing single-manifest flow
        setInstallVisible(true);
        setInstallDialogLoading(true);
        setWaitingForPlugins(true);
        setPlugin(undefined);

        const manifestResult = await pluginViewModel.fetchManifest(url);
        setInstallDialogLoading(false);

        if (manifestResult.status === 'success') {
          setPlugin(manifestResult.data);
          setWaitingForPlugins(false);
          setInstallVisible(true);
          setInstallOnConfirm(async () => {
            const fetchResult = await pluginViewModel.fetchPlugin(
              manifestResult.data,
            );
            if (fetchResult.status === 'success') {
              Alert.alert(
                'Installed',
                `${fetchResult.data.name} installed successfully`,
              );
              pluginViewModel.loadAllPluginsFromStorage();
            } else {
              Alert.alert('Installation failed', fetchResult.error ?? '');
            }
          });
        } else {
          setInstallVisible(false);
          Alert.alert('Error', manifestResult.error ?? 'Failed to fetch manifest');
        }
      } else {
        Alert.alert(
          'Unknown format',
          'The URL did not return a valid plugin manifest or repository.',
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not load URL');
    }

    setLoading(false);
  };

  return (
    <View>
      <Portal>
        <Dialog visible={visible} onDismiss={onDismiss}>
          <Dialog.Icon icon="package-variant-plus" />
          <Dialog.Title style={{ textAlign: 'center' }}>Add Plugin or Repository</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 8, opacity: 0.7 }}>
              Paste a single plugin manifest URL (.json) or a repository URL
              (lists multiple plugins — like CloudStream).
            </Text>
            <TextInput
              label="URL"
              value={url}
              mode="outlined"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="http://..."
              onChangeText={text => setUrl(text)}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={onDismiss}>Cancel</Button>
            <Button
              loading={loading}
              disabled={loading || !url}
              onPress={handleAdd}>
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const PluginListView = () => {
  const { plugins } = usePluginStore(state => state);
  const { deletePlugin, pluginToDelete, setPluginToDelete } = usePluginStore(
    state => state,
  );
  const { repos, removeRepo } = useRepoStore(state => state);
  const [showAddPluginDialog, setShowAddPluginDialog] = useState(false);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => { }, [pluginToDelete]);
  const theme = useTheme();

  return (
    <View
      style={{
        ...styles.container,
        backgroundColor: theme.colors.background,
      }}>
      {/* Installed plugins */}
      {plugins.length === 0 && repos.length === 0 ? (
        <View style={styles.noPlugins}>
          <Text>No plugins installed yet</Text>
          <View style={{ height: 8 }} />
          <Text>Tap + to add a plugin or repository</Text>
        </View>
      ) : (
        <View style={styles.pluginList}>
          {/* Saved Repositories section */}
          {repos.length > 0 && (
            <List.Section>
              <List.Subheader>Repositories</List.Subheader>
              {repos.map(repo => (
                <List.Item
                  key={repo.url}
                  title={repo.name}
                  description={`by ${repo.author} • ${repo.pluginCount} plugins`}
                  left={props => (
                    <List.Icon {...props} icon="package-variant" />
                  )}
                  right={props => (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <IconButton
                        {...props}
                        icon="open-in-new"
                        onPress={() =>
                          navigation.navigate('repoPluginListView', {
                            repoUrl: repo.url,
                          })
                        }
                      />
                      <IconButton
                        {...props}
                        icon="trash-can"
                        onPress={() => {
                          Alert.alert(
                            'Remove Repository',
                            `Remove "${repo.name}" from your repository list?`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Remove',
                                style: 'destructive',
                                onPress: () => removeRepo(repo.url),
                              },
                            ],
                          );
                        }}
                      />
                    </View>
                  )}
                  onPress={() =>
                    navigation.navigate('repoPluginListView', {
                      repoUrl: repo.url,
                    })
                  }
                />
              ))}
              <Divider />
            </List.Section>
          )}

          {/* Installed plugins */}
          {plugins.length > 0 && (
            <List.Section>
              <List.Subheader>Installed Plugins</List.Subheader>
              <PluginList plugins={plugins} />
            </List.Section>
          )}
        </View>
      )}

      {pluginToDelete && (
        <ConfirmOrDenyDialog
          visible={Boolean(pluginToDelete)}
          onConfirm={async () => {
            await deletePlugin(pluginToDelete);
            setPluginToDelete(null);
          }}
          onCancel={() => setPluginToDelete(null)}
          title={`Delete ${pluginToDelete.name}?`}
          reason="Are you sure you want to delete this plugin?"
        />
      )}

      <FAB
        icon="plus"
        mode="flat"
        color={theme.colors.onSurface}
        style={{
          backgroundColor: theme.colors.surface,
          position: 'absolute',
          bottom: 8,
          right: 8,
        }}
        onPress={() => {
          setShowAddPluginDialog(true);
        }}
      />
      <AddPluginDialog
        visible={showAddPluginDialog}
        onDismiss={() => {
          setShowAddPluginDialog(false);
        }}
      />
    </View>
  );
};

export default PluginListView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  noPlugins: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pluginList: {
    flex: 1,
    width: '100%',
    height: '100%',
    maxWidth: Dimensions.get('window').width - 16,
  },
});
