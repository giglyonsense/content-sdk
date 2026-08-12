---
'@sitecore-content-sdk/search': minor
'@sitecore-content-sdk/react': minor
---

Add typeahead suggestions to the search package and React hooks

- `SearchService.suggest` performs typeahead requests and returns `querySuggestions` (autocomplete completions) and `previewResults` (matching documents)
- Both collections are always present: a collection is empty when the corresponding suggestion mode is disabled in the index configuration or when there are no matches
- Three new public types exported from `@sitecore-content-sdk/search`: `SuggestParameters`, `SuggestResponse`, `QuerySuggestion`
- New `useSuggest` hook in `@sitecore-content-sdk/react` with automatic state management, request cancellation, and request status tracking; an empty keyphrase resets the suggestions instead of sending a request
