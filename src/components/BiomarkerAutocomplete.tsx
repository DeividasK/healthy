import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Search, X, Check, Sparkles, CornerDownLeft } from 'lucide-react-native';
import { BiomarkerDefinition } from '../types/health';
import { searchBiomarkers, findBiomarkerByKey } from '../data/biomarker-catalog';
import { useLanguage } from '../i18n';
import { getBiomarkerDisplayName } from '../i18n/biomarkers';

interface BiomarkerAutocompleteProps {
  placeholder?: string;
  onSelect: (biomarker: BiomarkerDefinition) => void;
  selectedKey?: string;
  autoFocus?: boolean;
}

const QUICK_SUGGESTIONS_EN = [
  { label: 'Glucose', key: 'metabolic_fasting_glucose' },
  { label: 'HbA1c', key: 'metabolic_hba1c' },
  { label: 'Total Cholesterol', key: 'lipid_total_cholesterol' },
  { label: 'WBC', key: 'cbc_wbc' },
  { label: 'TSH', key: 'thyroid_tsh' },
  { label: 'Creatinine', key: 'renal_creatinine' },
  { label: 'ALT (Liver)', key: 'liver_alt' },
  { label: 'Ferritin', key: 'iron_ferritin' },
];

const QUICK_SUGGESTIONS_LT = [
  { label: 'Gliukozė', key: 'metabolic_fasting_glucose' },
  { label: 'HbA1c', key: 'metabolic_hba1c' },
  { label: 'Bendras cholesterolis', key: 'lipid_total_cholesterol' },
  { label: 'WBC (Leukocitai)', key: 'cbc_wbc' },
  { label: 'TTH (Tirotropinas)', key: 'thyroid_tsh' },
  { label: 'Kreatininas', key: 'renal_creatinine' },
  { label: 'ALT (Kepenys)', key: 'liver_alt' },
  { label: 'Feritinas', key: 'iron_ferritin' },
];

export function BiomarkerAutocomplete({
  placeholder,
  onSelect,
  selectedKey,
  autoFocus = false,
}: BiomarkerAutocompleteProps) {
  const { language, t } = useLanguage();
  const quickSuggestions = language === 'lt' ? QUICK_SUGGESTIONS_LT : QUICK_SUGGESTIONS_EN;
  const defaultPlaceholder =
    language === 'lt'
      ? 'Ieškoti iš 200+ rodiklių (pvz., Gliukozė, Feritinas, TTH)...'
      : 'Search 200+ biomarkers (e.g. Glucose, A1C, WBC, TSH)...';
  const effectivePlaceholder = placeholder || defaultPlaceholder;
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [isFocused, setIsFocused] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchBiomarkers(query);
  }, [query]);

  const displayedResults = useMemo(() => results.slice(0, 8), [results]);
  const remainingCount = Math.max(0, results.length - displayedResults.length);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setHighlightedIndex(0);
  };

  const handleSelect = (item: BiomarkerDefinition) => {
    onSelect(item);
    setQuery('');
    setHighlightedIndex(0);
  };

  const handleSelectByKey = (key: string) => {
    const item = findBiomarkerByKey(key);
    if (item) {
      onSelect(item);
      setQuery('');
      setHighlightedIndex(0);
    }
  };

  const handleClear = () => {
    setQuery('');
    setHighlightedIndex(0);
  };

  // Keyboard navigation for dropdown (ArrowDown, ArrowUp, Enter, Escape)
  const handleKeyDown = (e: any) => {
    const key = e.nativeEvent?.key;

    if (key === 'ArrowDown' || key === 'Down') {
      e.preventDefault?.();
      if (displayedResults.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % displayedResults.length);
      }
    } else if (key === 'ArrowUp' || key === 'Up') {
      e.preventDefault?.();
      if (displayedResults.length > 0) {
        setHighlightedIndex((prev) =>
          prev <= 0 ? displayedResults.length - 1 : prev - 1
        );
      }
    } else if (key === 'Enter') {
      if (
        displayedResults.length > 0 &&
        highlightedIndex >= 0 &&
        highlightedIndex < displayedResults.length
      ) {
        e.preventDefault?.();
        handleSelect(displayedResults[highlightedIndex]);
      }
    } else if (key === 'Escape' || key === 'Esc') {
      e.preventDefault?.();
      handleClear();
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: isDark ? '#1F2937' : '#F8FAFC',
            borderColor: isFocused ? '#2563EB' : isDark ? '#374151' : '#CBD5E1',
          },
        ]}
      >
        <Search
          size={18}
          color={isFocused ? '#2563EB' : isDark ? '#9CA3AF' : '#6B7280'}
          style={styles.searchIcon}
        />
        <TextInput
          style={[
            styles.input,
            { color: isDark ? '#F9FAFB' : '#111827' },
          ]}
          placeholder={effectivePlaceholder}
          placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
          value={query}
          onChangeText={handleQueryChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyPress={handleKeyDown}
          onSubmitEditing={() => {
            if (
              displayedResults.length > 0 &&
              highlightedIndex >= 0 &&
              highlightedIndex < displayedResults.length
            ) {
              handleSelect(displayedResults[highlightedIndex]);
            }
          }}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.clearBtn}
          >
            <X size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
          </TouchableOpacity>
        )}
      </View>

      {/* When query is empty: Show Quick Popular Suggestions */}
      {query.trim().length === 0 && (
        <View style={styles.quickSection}>
          <View style={styles.quickHeader}>
            <Sparkles size={13} color="#2563EB" />
            <Text
              style={[
                styles.quickTitle,
                { color: isDark ? '#94A3B8' : '#64748B' },
              ]}
            >
              {language === 'lt' ? 'Dažniausi:' : 'Popular:'}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickChipsScroll}
          >
            {quickSuggestions.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.quickChip,
                  {
                    backgroundColor: isDark ? '#334155' : '#F1F5F9',
                    borderColor: isDark ? '#475569' : '#E2E8F0',
                  },
                ]}
                onPress={() => handleSelectByKey(item.key)}
              >
                <Text
                  style={[
                    styles.quickChipText,
                    { color: isDark ? '#E2E8F0' : '#334155' },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Autocomplete Results List rendered IN-FLOW with keyboard navigation */}
      {query.trim().length > 0 && (
        <View
          style={[
            styles.resultsContainer,
            {
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
              borderColor: isDark ? '#374151' : '#E2E8F0',
            },
          ]}
        >
          {results.length === 0 ? (
            <View style={styles.emptyState}>
              <Text
                style={[
                  styles.emptyText,
                  { color: isDark ? '#9CA3AF' : '#6B7280' },
                ]}
              >
                {language === 'lt'
                  ? `Nerasta rodiklių pagal „${query}“`
                  : `No matching biomarkers found for "${query}"`}
              </Text>
            </View>
          ) : (
            <>
              {displayedResults.map((item, idx) => {
                const isHighlighted = highlightedIndex === idx;
                const isSelected = selectedKey === item.canonicalKey;
                const isLast = idx === displayedResults.length - 1 && remainingCount === 0;
                const displayName = getBiomarkerDisplayName(item, language);
                const categoryLabel = t(`biomarkers.categories.${item.category}`) || item.category;

                return (
                  <TouchableOpacity
                    key={item.canonicalKey}
                    style={[
                      styles.itemRow,
                      {
                        borderBottomColor: isDark ? '#374151' : '#F1F5F9',
                        borderBottomWidth: isLast ? 0 : 1,
                        backgroundColor: isHighlighted
                          ? isDark
                            ? '#1E3A8A'
                            : '#EFF6FF'
                          : isSelected
                          ? isDark
                            ? '#263349'
                            : '#F8FAFC'
                          : 'transparent',
                        borderLeftColor: isHighlighted ? '#2563EB' : 'transparent',
                        borderLeftWidth: 3,
                      },
                    ]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.itemMain}>
                      <View style={styles.titleRow}>
                        <Text
                          style={[
                            styles.itemName,
                            { color: isDark ? '#F9FAFB' : '#111827' },
                            isHighlighted && {
                              color: isDark ? '#60A5FA' : '#1D4ED8',
                              fontWeight: '700',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {displayName}
                        </Text>
                        <View style={styles.titleRight}>
                          {isSelected && <Check size={16} color="#2563EB" />}
                          {isHighlighted && (
                            <View
                              style={[
                                styles.enterBadge,
                                {
                                  backgroundColor: isDark ? '#1E293B' : '#DBEAFE',
                                  borderColor: isDark ? '#3B82F6' : '#93C5FD',
                                },
                              ]}
                            >
                              <CornerDownLeft
                                size={10}
                                color={isDark ? '#93C5FD' : '#1D4ED8'}
                              />
                              <Text
                                style={[
                                  styles.enterBadgeText,
                                  { color: isDark ? '#93C5FD' : '#1D4ED8' },
                                ]}
                              >
                                Enter
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {language === 'lt' && displayName !== item.name && (
                        <Text
                          style={[
                            styles.aliasSubtext,
                            { color: isDark ? '#94A3B8' : '#64748B' },
                          ]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                      )}

                      <View style={styles.badgeRow}>
                        <View
                          style={[
                            styles.categoryBadge,
                            {
                              backgroundColor: isDark ? '#374151' : '#F1F5F9',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.categoryText,
                              { color: isDark ? '#D1D5DB' : '#475569' },
                            ]}
                          >
                            {categoryLabel}
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.unitText,
                            { color: isDark ? '#9CA3AF' : '#6B7280' },
                          ]}
                        >
                          {language === 'lt' ? 'Vnt.' : 'Unit'}: {item.primaryUnit}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {remainingCount > 0 && (
                <View
                  style={[
                    styles.moreIndicator,
                    {
                      backgroundColor: isDark ? '#111827' : '#F8FAFC',
                      borderTopColor: isDark ? '#374151' : '#F1F5F9',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.moreText,
                      { color: isDark ? '#94A3B8' : '#64748B' },
                    ]}
                  >
                    {language === 'lt'
                      ? `+ dar ${remainingCount} — tikslinkite paiešką`
                      : `+ ${remainingCount} more matches — keep typing to refine`}
                  </Text>
                </View>
              )}

              {/* Keyboard navigation helper bar */}
              <View
                style={[
                  styles.keyboardHintBar,
                  {
                    backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                    borderTopColor: isDark ? '#374151' : '#E2E8F0',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.keyboardHintText,
                    { color: isDark ? '#64748B' : '#94A3B8' },
                  ]}
                >
                  {language === 'lt'
                    ? '↑ ↓ naršyti • ↵ Pasirinkti • Esc išvalyti'
                    : '↑ ↓ to navigate • ↵ Enter to select • Esc to clear'}
                </Text>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  clearBtn: {
    padding: 4,
  },
  quickSection: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  quickChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resultsContainer: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  itemRow: {
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  itemMain: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  titleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  enterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  enterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  keyboardHintBar: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  keyboardHintText: {
    fontSize: 11,
    fontWeight: '500',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  aliasSubtext: {
    fontSize: 12,
    marginTop: 1,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '500',
  },
  unitText: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyState: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  moreIndicator: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  moreText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

