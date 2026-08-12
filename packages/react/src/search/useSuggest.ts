import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QuerySuggestion, SearchDocument, SuggestParameters } from '@sitecore-content-sdk/search';
import { SearchStatus, useSearchService } from './utils';

/**
 * Options for the useSuggest hook.
 * @public
 */
export interface UseSuggestOptions {
  /**
   * The partial text to get suggestions for.
   * When empty, no request is made and the suggestions are reset.
   */
  keyphrase: string;
  /**
   * The ID of the search index to use.
   */
  searchIndexId: string;
  /**
   * The locale to use for the suggestions. Required for multi-locale index configurations.
   * Format: letters and hyphens only (e.g. 'en', 'fr-FR', 'el-GR').
   * Omit for single-locale indexes.
   */
  locale?: string;
  /**
   * Specifies whether the suggestions should automatically be fetched.
   * @default true
   */
  enabled?: boolean;
  /**
   * Specifies whether the previous suggestions should be kept while fetching new ones.
   * @default false
   */
  keepPreviousData?: boolean;
}

type InternalState<T extends SearchDocument = SearchDocument> = {
  /**
   * Autocomplete suggestions for the keyphrase.
   */
  querySuggestions: QuerySuggestion[];
  /**
   * Documents matching the keyphrase, to preview results while the visitor is typing.
   */
  previewResults: T[];
  /**
   * The error object if the last suggest request failed, or null if no error occurred.
   */
  error: Error | null;
  /**
   * The status of the suggest request.
   * It will be set to:
   * - 'idle' if no suggest request has been made yet.
   * - 'loading' if a suggest request is currently in progress.
   * - 'success' if a suggest request was successful.
   * - 'error' if a suggest request failed.
   * @default 'idle'
   */
  status: SearchStatus;
  /**
   * The status of the previous suggest request.
   * @default 'idle'
   */
  previousStatus: SearchStatus;
};

/**
 * The state of the useSuggest hook.
 * @public
 */
export type UseSuggestState<T extends SearchDocument = SearchDocument> = Omit<
  InternalState<T>,
  'previousStatus'
> & {
  /**
   * Whether a suggest request is currently in progress.
   */
  isLoading: boolean;
  /**
   * Whether the suggest request was successful.
   */
  isSuccess: boolean;
  /**
   * Whether the suggest request failed.
   */
  isError: boolean;
  /**
   * Whether the suggestions from the previous keyphrase are returned.
   * Will be `true` if `keepPreviousData` is set.
   */
  isPreviousData: boolean;
};

/**
 * React hook for fetching typeahead suggestions.
 * The suggestion modes to run are defined in the index configuration, so a mode that is
 * disabled there returns an empty collection.
 * @param {UseSuggestOptions} options - Configuration options for the suggest hook.
 * @returns {UseSuggestState} The suggest state.
 * @public
 */
export const useSuggest = <T extends SearchDocument = SearchDocument>(
  options: UseSuggestOptions
): UseSuggestState<T> => {
  const {
    keyphrase,
    searchIndexId,
    locale,
    enabled = true,
    keepPreviousData = false,
  } = options;

  const [state, setState] = useState<InternalState<T>>(() => {
    const error = !searchIndexId
      ? new Error('useSuggest: searchIndexId is required when initializing the hook')
      : null;

    const status = !searchIndexId ? 'error' : 'idle';

    return {
      querySuggestions: [],
      previewResults: [],
      error,
      status,
      previousStatus: 'idle',
    };
  });

  const searchService = useSearchService();
  const abortControllerRef = useRef<AbortController | null>(null);

  const suggest = useCallback(async () => {
    if (!searchService || !searchIndexId) {
      return;
    }

    if (!keyphrase?.trim()) {
      setState({
        querySuggestions: [],
        previewResults: [],
        error: null,
        status: 'idle',
        previousStatus: 'idle',
      });

      return;
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setState((prev) => ({
      querySuggestions: keepPreviousData ? prev.querySuggestions : [],
      previewResults: keepPreviousData ? prev.previewResults : [],
      error: null,
      status: 'loading',
      previousStatus: prev.status,
    }));

    try {
      const suggestParams: SuggestParameters = {
        searchIndexId,
        keyphrase,
        ...(locale !== undefined && { locale }),
      };

      const { querySuggestions, previewResults } = await searchService.suggest<T>(suggestParams, {
        signal,
      });

      if (signal.aborted) {
        return;
      }

      setState({
        querySuggestions,
        previewResults,
        error: null,
        status: 'success',
        previousStatus: 'success',
      });
    } catch (err) {
      // Don't set error if request was aborted
      if (signal.aborted) {
        return;
      }

      const errorMessage = err instanceof Error ? err : new Error(JSON.stringify(err));
      setState({
        querySuggestions: [],
        previewResults: [],
        error: errorMessage,
        status: 'error',
        previousStatus: 'error',
      });
    }
  }, [searchService, searchIndexId, keyphrase, locale, keepPreviousData]);

  useEffect(() => {
    if (enabled) {
      suggest();
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [suggest, enabled]);

  return useMemo(
    (): UseSuggestState<T> => ({
      querySuggestions: state.querySuggestions,
      previewResults: state.previewResults,
      error: state.error,
      status: state.status,
      isLoading: state.status === 'loading',
      isSuccess: state.status === 'success',
      isError: state.status === 'error',
      isPreviousData:
        keepPreviousData && state.previousStatus === 'success' && state.status === 'loading',
    }),
    [state, keepPreviousData]
  );
};
