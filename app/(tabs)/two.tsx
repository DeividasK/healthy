import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import {
  Search,
  X,
  Plus,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Activity,
  Layers,
} from 'lucide-react-native';
import { BIOMARKER_CATALOG } from '../../src/data/biomarker-catalog';
import {
  BiomarkerDefinition,
  BiomarkerCategory,
  BiomarkerResult,
} from '../../src/types/health';
import { useLabReports } from '../../src/context/LabReportsContext';
import { formatValue } from '../../src/utils/units';
import { useResponsive } from '../../src/hooks/useResponsive';
import { WhoopBiomarkerCard } from '../../src/components/WhoopBiomarkerCard';
import { WhoopBiomarkerModal } from '../../src/components/WhoopBiomarkerModal';
import { WhoopAmbientHeader } from '../../src/components/WhoopAmbientHeader';
import { useTranslation } from 'react-i18next';
import {
  getBiomarkerDisplayName,
  getBiomarkerDescription,
  useBiomarkerTranslations,
} from '../../src/i18n/biomarkers';

const CATEGORIES: (BiomarkerCategory | 'All')[] = [
  'All',
  'CBC & Hematology',
  'Lipids & Cardiovascular',
  'Metabolic & Renal',
  'Liver & Enzymes',
  'Thyroid & Endocrine',
  'Hormones & Reproductive',
  'Vitamins & Nutrition',
  'Iron & Anemia',
  'Inflammation & Immunology',
  'Coagulation',
  'Electrolytes & Minerals',
  'Trace Elements & Heavy Metals',
];

export default function BiomarkersScreen() {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'lt' ? 'lt' : 'en';
  const { catalog: biomarkerCatalog } = useBiomarkerTranslations();
  const [activeTab, setActiveTab] = useState<'my-biomarkers' | 'catalog'>('my-biomarkers');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<BiomarkerCategory | 'All'>('All');
  const [selectedMarker, setSelectedMarker] = useState<BiomarkerResult | null>(null);

  const { reports, isLoading } = useLabReports();
  const { isLargeScreen, contentMaxWidth, containerPadding } = useResponsive();

  // Extract latest recorded biomarkers across all reports
  const latestUserMarkers = useMemo(() => {
    const map = new Map<string, BiomarkerResult>();

    // Reports are ordered newest first
    for (const report of reports) {
      for (const m of report.markers) {
        const key = m.canonicalKey || m.name.toLowerCase();
        if (!map.has(key) && m.value !== undefined) {
          map.set(key, m);
        }
      }
    }

    return Array.from(map.values());
  }, [reports]);

  // Group user biomarkers into Out of Range and Sufficient
  const { outOfRangeMarkers, sufficientMarkers, otherMarkers } = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = latestUserMarkers.filter((m) => {
      if (!q) return true;
      const localizedName = getBiomarkerDisplayName(m, language).toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        localizedName.includes(q) ||
        (m.canonicalKey && m.canonicalKey.toLowerCase().includes(q)) ||
        (m.category && m.category.toLowerCase().includes(q))
      );
    });

    const outOfRange = filtered.filter(
      (m) =>
        m.status === 'low' ||
        m.status === 'high' ||
        m.status === 'critical'
    );
    const sufficient = filtered.filter((m) => m.status === 'normal');
    const other = filtered.filter(
      (m) =>
        m.status !== 'normal' &&
        m.status !== 'low' &&
        m.status !== 'high' &&
        m.status !== 'critical'
    );

    return {
      outOfRangeMarkers: outOfRange,
      sufficientMarkers: sufficient,
      otherMarkers: other,
    };
  }, [latestUserMarkers, search, language]);

  // Filter Catalog
  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();

    return BIOMARKER_CATALOG.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      const localEntry = biomarkerCatalog[item.canonicalKey];
      return (
        item.name.toLowerCase().includes(q) ||
        item.canonicalKey.toLowerCase().includes(q) ||
        item.loinc.includes(q) ||
        item.aliases.some((alias) => alias.toLowerCase().includes(q)) ||
        (localEntry && localEntry.name.toLowerCase().includes(q)) ||
        (localEntry && localEntry.aliases.some((alias) => alias.toLowerCase().includes(q)))
      );
    });
  }, [search, selectedCategory, biomarkerCatalog]);

  return (
    <View style={styles.container}>
      {/* WHOOP Ambient Emerald Header */}
      <WhoopAmbientHeader
        title={t('biomarkers.title')}
        onAction={() => router.push('/add-report')}
        actionIcon="download"
      />

      <View
        style={[
          styles.mainWrapper,
          {
            maxWidth: contentMaxWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        {/* Mode Switcher Segmented Control */}
        <View style={[styles.segmentedWrap, { paddingHorizontal: containerPadding }]}>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                activeTab === 'my-biomarkers' && styles.segmentBtnActive,
              ]}
              onPress={() => setActiveTab('my-biomarkers')}
              activeOpacity={0.8}
            >
              <Activity
                size={14}
                color={activeTab === 'my-biomarkers' ? '#00C48C' : '#8E9CAE'}
              />
              <Text
                style={[
                  styles.segmentText,
                  activeTab === 'my-biomarkers' && styles.segmentTextActive,
                ]}
              >
                {t('biomarkers.myBiomarkers')} ({latestUserMarkers.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                activeTab === 'catalog' && styles.segmentBtnActive,
              ]}
              onPress={() => setActiveTab('catalog')}
              activeOpacity={0.8}
            >
              <BookOpen
                size={14}
                color={activeTab === 'catalog' ? '#00C48C' : '#8E9CAE'}
              />
              <Text
                style={[
                  styles.segmentText,
                  activeTab === 'catalog' && styles.segmentTextActive,
                ]}
              >
                {t('biomarkers.catalog')} ({BIOMARKER_CATALOG.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Input Bar */}
        <View style={[styles.searchBarWrapper, { paddingHorizontal: containerPadding }]}>
          <View style={styles.searchInputContainer}>
            <Search size={16} color="#6B7A8D" />
            <TextInput
              style={styles.searchInput}
              placeholder={
                activeTab === 'my-biomarkers'
                  ? t('biomarkers.searchMeasured')
                  : t('biomarkers.searchCatalog')
              }
              placeholderTextColor="#6B7A8D"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={16} color="#8E9CAE" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* TAB 1: MY BIOMARKERS (WHOOP LABS VIEW) */}
        {activeTab === 'my-biomarkers' ? (
          latestUserMarkers.length === 0 ? (
            // Empty State: Prompt to Load WHOOP Sample Labs or Add Report
            <ScrollView
              contentContainerStyle={[
                styles.emptyContainer,
                { paddingHorizontal: containerPadding },
              ]}
            >
              <View style={styles.whoopBanner}>
                <View style={styles.whoopBannerGlow}>
                  <Sparkles size={32} color="#00C48C" />
                </View>
                <Text style={styles.whoopBannerTitle}>
                  {t('biomarkers.whoopBannerTitle')}
                </Text>
                <Text style={styles.whoopBannerDesc}>
                  {t('biomarkers.whoopBannerDesc')}
                </Text>

                <TouchableOpacity
                  style={styles.addTestBtn}
                  onPress={() => router.push('/add-report')}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={styles.addTestBtnText}>{t('biomarkers.addTestBtn')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            // Populated WHOOP Biomarkers List
            <ScrollView
              contentContainerStyle={[
                styles.listContent,
                { paddingHorizontal: containerPadding },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {/* SECTION: OUT OF RANGE (Needs Attention) */}
              {outOfRangeMarkers.length > 0 && (
                <View style={styles.sectionWrap}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>{t('biomarkers.needsAttention')}</Text>
                    <Text style={styles.sectionSubtitle}>
                      {outOfRangeMarkers.length === 1
                        ? t('biomarkers.biomarkerSingle', { count: 1 })
                        : t('biomarkers.biomarkersCount', { count: outOfRangeMarkers.length })}
                    </Text>
                  </View>

                  <View
                    style={
                      isLargeScreen && outOfRangeMarkers.length > 1
                        ? styles.gridContainer
                        : undefined
                    }
                  >
                    {outOfRangeMarkers.map((marker) => (
                      <View
                        key={marker.id}
                        style={
                          isLargeScreen && outOfRangeMarkers.length > 1
                            ? styles.gridItem
                            : undefined
                        }
                      >
                        <WhoopBiomarkerCard
                          marker={marker}
                          onPress={() => setSelectedMarker(marker)}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* SECTION: SUFFICIENT (In Range) */}
              {sufficientMarkers.length > 0 && (
                <View style={styles.sectionWrap}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>{t('biomarkers.sufficient')}</Text>
                    <Text style={styles.sectionSubtitle}>
                      {t('biomarkers.biomarkersCount', { count: sufficientMarkers.length })}
                    </Text>
                  </View>

                  <View
                    style={
                      isLargeScreen && sufficientMarkers.length > 1
                        ? styles.gridContainer
                        : undefined
                    }
                  >
                    {sufficientMarkers.map((marker) => (
                      <View
                        key={marker.id}
                        style={
                          isLargeScreen && sufficientMarkers.length > 1
                            ? styles.gridItem
                            : undefined
                        }
                      >
                        <WhoopBiomarkerCard
                          marker={marker}
                          onPress={() => setSelectedMarker(marker)}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* SECTION: OTHER MARKERS */}
              {otherMarkers.length > 0 && (
                <View style={styles.sectionWrap}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>{t('biomarkers.otherResults')}</Text>
                    <Text style={styles.sectionSubtitle}>
                      {t('biomarkers.biomarkersCount', { count: otherMarkers.length })}
                    </Text>
                  </View>

                  {otherMarkers.map((marker) => (
                    <WhoopBiomarkerCard
                      key={marker.id}
                      marker={marker}
                      onPress={() => setSelectedMarker(marker)}
                    />
                  ))}
                </View>
              )}
            </ScrollView>
          )
        ) : (
          // TAB 2: REFERENCE CATALOG DIRECTORY
          <View style={styles.catalogWrapper}>
            {/* Category Filter Pills */}
            <View style={styles.categoriesWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[
                  styles.categoriesScroll,
                  { paddingHorizontal: containerPadding },
                ]}
              >
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  const label = t(`biomarkers.categories.${cat}`) || cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catPill,
                        isSelected && styles.catPillActive,
                      ]}
                      onPress={() => setSelectedCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.catPillText,
                          isSelected && styles.catPillTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <FlatList
              data={filteredCatalog}
              keyExtractor={(item) => item.canonicalKey}
              contentContainerStyle={[
                styles.listContent,
                { paddingHorizontal: containerPadding },
              ]}
              renderItem={({ item }) => {
                // Find if user has a measurement for this marker
                const userMatch = latestUserMarkers.find(
                  (m) =>
                    m.canonicalKey === item.canonicalKey ||
                    m.name.toLowerCase() === item.name.toLowerCase()
                );
                const categoryLabel = t(`biomarkers.categories.${item.category}`) || item.category;

                const displayName = getBiomarkerDisplayName(item, language);
                const displayDesc = getBiomarkerDescription(item, language);

                return (
                  <View style={styles.catalogCard}>
                    <View style={styles.catalogCardTop}>
                      <View style={styles.catalogTitleArea}>
                        <Text style={styles.catalogName}>{displayName}</Text>
                        {language === 'lt' && displayName !== item.name && (
                          <Text style={styles.catalogSubname}>{item.name}</Text>
                        )}
                        <Text style={styles.catalogCategory}>
                          {categoryLabel} • LOINC {item.loinc}
                        </Text>
                      </View>
                      {userMatch && (
                        <View style={styles.catalogMeasuredBadge}>
                          <Text style={styles.catalogMeasuredText}>
                            {t('biomarkers.yourLatest')}: {formatValue(userMatch.value || 0)}{' '}
                            {userMatch.unit}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.catalogDesc} numberOfLines={2}>
                      {displayDesc || item.description}
                    </Text>

                    <View style={styles.catalogRefBox}>
                      <Text style={styles.catalogRefLabel}>
                        {t('biomarkers.standardInterval')}:
                      </Text>
                      <Text style={styles.catalogRefValue}>
                        {item.referenceIntervals.conventional.text ||
                          `${item.referenceIntervals.conventional.min} - ${item.referenceIntervals.conventional.max} ${item.primaryUnit}`}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          </View>
        )}
      </View>

      {/* Detail Modal */}
      <WhoopBiomarkerModal
        visible={!!selectedMarker}
        marker={selectedMarker}
        allReports={reports}
        onClose={() => setSelectedMarker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1217',
  },
  mainWrapper: {
    flex: 1,
  },
  segmentedWrap: {
    paddingVertical: 10,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#161C24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#232D3B',
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#202936',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E9CAE',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  searchBarWrapper: {
    paddingBottom: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#161C24',
    borderWidth: 1,
    borderColor: '#232D3B',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 48,
  },
  sectionWrap: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E9CAE',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    flex: 1,
    minWidth: 320,
    maxWidth: '49.5%',
  },
  emptyContainer: {
    paddingTop: 24,
    paddingBottom: 40,
  },
  whoopBanner: {
    backgroundColor: '#161C24',
    borderWidth: 1,
    borderColor: '#232D3B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  whoopBannerGlow: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 196, 140, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  whoopBannerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  whoopBannerDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: '#8E9CAE',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  sampleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00C48C',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
    marginBottom: 12,
  },
  sampleBtnText: {
    color: '#0D1217',
    fontSize: 15,
    fontWeight: '800',
  },
  addTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#202936',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '100%',
  },
  addTestBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  catalogWrapper: {
    flex: 1,
  },
  categoriesWrap: {
    marginBottom: 10,
  },
  categoriesScroll: {
    gap: 8,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#161C24',
    borderWidth: 1,
    borderColor: '#232D3B',
  },
  catPillActive: {
    backgroundColor: '#00C48C',
    borderColor: '#00C48C',
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E9CAE',
  },
  catPillTextActive: {
    color: '#0D1217',
    fontWeight: '700',
  },
  catalogCard: {
    backgroundColor: '#161C24',
    borderWidth: 1,
    borderColor: '#232D3B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  catalogCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  catalogTitleArea: {
    flex: 1,
    marginRight: 8,
  },
  catalogName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  catalogSubname: {
    fontSize: 12,
    color: '#8E9CAE',
    marginBottom: 2,
  },
  catalogCategory: {
    fontSize: 11,
    color: '#8E9CAE',
  },
  catalogMeasuredBadge: {
    backgroundColor: 'rgba(0, 196, 140, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  catalogMeasuredText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00C48C',
  },
  catalogDesc: {
    fontSize: 12,
    lineHeight: 17,
    color: '#CBD5E1',
    marginBottom: 8,
  },
  catalogRefBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#121820',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  catalogRefLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E9CAE',
  },
  catalogRefValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F1F5F9',
  },
});
