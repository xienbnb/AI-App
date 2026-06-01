import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

interface Article {
  id: string;
  title: string;
  content: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
}

export default function HomeScreen() {
  const router = useSafeRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchArticles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing`);
      const json = await res.json();
      if (json.success) {
        setArticles(json.data);
      }
    } catch (e) {
      console.error('获取文章列表失败:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchArticles();
    }, [fetchArticles])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchArticles();
  };

  const handleNew = () => {
    router.push('/write');
  };

  const handleDetail = (id: string) => {
    router.push('/detail', { id });
  };

  const getSummary = (content: string) => {
    return content.replace(/##.*\n?/g, '').trim().substring(0, 80) + (content.length > 80 ? '...' : '');
  };

  const renderArticle = ({ item }: { item: Article }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => handleDetail(item.id)}
      style={styles.cardWrapper}
    >
      <View style={styles.shadowDark}>
        <View style={styles.shadowLight}>
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <FontAwesome6 name="file-pen" size={18} color="#6C63FF" />
            </View>
            <View style={styles.cardTextArea}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title || '无标题'}
              </Text>
              <Text style={styles.cardDate}>{item.updatedAt}</Text>
            </View>
            <FontAwesome6 name="chevron-right" size={14} color="#B2BEC3" />
          </View>
          <Text style={styles.cardSummary} numberOfLines={2}>
            {getSummary(item.content)}
          </Text>
          <View style={styles.topicTag}>
            <Text style={styles.topicText}>{item.topic || '通用写作'}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <FontAwesome6 name="feather" size={40} color="#6C63FF" />
        </View>
        <Text style={styles.emptyTitle}>开始你的第一篇创作</Text>
        <Text style={styles.emptyDesc}>
          点击右下角的「+」按钮，输入主题，让AI辅助你写作
        </Text>
      </View>
    );
  };

  return (
    <Screen backgroundColor="#F0F0F3" safeAreaEdges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>灵犀写作</Text>
            <Text style={styles.subtitle}>AI 智能写作助手，让灵感流淌</Text>
          </View>
          <View style={styles.headerIconContainer}>
            <FontAwesome6 name="wand-magic-sparkles" size={22} color="#6C63FF" />
          </View>
        </View>

        {/* Stats */}
        {!loading && articles.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.shadowDark}>
              <View style={[styles.shadowLight, styles.statsCard]}>
                <Text style={styles.statsNumber}>{articles.length}</Text>
                <Text style={styles.statsLabel}>总作品</Text>
              </View>
            </View>
          </View>
        )}

        {/* List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6C63FF" />
          </View>
        ) : (
          <FlatList
            data={articles}
            keyExtractor={(item) => item.id}
            renderItem={renderArticle}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#6C63FF"
                colors={['#6C63FF']}
              />
            }
          />
        )}

        {/* FAB */}
        <TouchableOpacity activeOpacity={0.8} onPress={handleNew} style={styles.fab}>
          <LinearGradient
            colors={['#6C63FF', '#896BFF']}
            style={styles.fabGradient}
          >
            <FontAwesome6 name="plus" size={24} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F3',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2D3436',
  },
  subtitle: {
    fontSize: 14,
    color: '#636E72',
    marginTop: 4,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(108,99,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  statsNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#6C63FF',
    marginRight: 8,
  },
  statsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636E72',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 120,
  },
  cardWrapper: {
    marginBottom: 14,
  },
  shadowDark: {
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    borderRadius: 24,
    ...Platform.select({
      android: {
        elevation: 6,
      },
    }),
  },
  shadowLight: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: -6, height: -6 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    backgroundColor: '#F0F0F3',
    borderRadius: 24,
    padding: 20,
    ...Platform.select({
      android: {
        backgroundColor: '#F0F0F3',
        borderRadius: 24,
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.5)',
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(108,99,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTextArea: {
    flex: 1,
    marginLeft: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3436',
  },
  cardDate: {
    fontSize: 12,
    color: '#636E72',
    marginTop: 2,
  },
  cardSummary: {
    fontSize: 13,
    color: '#636E72',
    marginTop: 10,
    lineHeight: 18,
  },
  topicTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(108,99,255,0.10)',
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 10,
  },
  topicText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C63FF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(108,99,255,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#636E72',
    textAlign: 'center',
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 40,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    ...Platform.select({
      android: {
        elevation: 8,
      },
    }),
  },
});