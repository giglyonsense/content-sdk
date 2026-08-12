/* eslint-disable no-unused-expressions */
import React, { useState } from 'react';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { render, waitFor, fireEvent, RenderResult } from '@testing-library/react';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { SearchService } from '@sitecore-content-sdk/search';
import {
  SitecoreProviderReactContext,
  SitecoreProviderState,
} from '../components/SitecoreProvider';
import { useSuggest, UseSuggestState } from './useSuggest';

type Model = { id: string };

describe('useSuggest', () => {
  let sandbox: SinonSandbox;

  const defaultProviderState = {
    api: {
      edge: {
        contextId: 'id',
        edgeUrl: 'url',
        clientContextId: 'clientId',
      },
    },
  } as SitecoreProviderState;

  let suggestServiceStub: SinonStub;

  beforeEach(function () {
    sandbox = createSandbox();
    suggestServiceStub = sandbox.stub(SearchService.prototype, 'suggest');
  });

  afterEach(() => {
    sandbox.restore();
  });

  const assertState = (wrapper: RenderResult, state: UseSuggestState<Model>) => {
    expect(wrapper.container.querySelector('#status')?.textContent).equal(state.status);
    expect(wrapper.container.querySelector('#isLoading')?.textContent).equal(
      state.isLoading ? 'true' : 'false'
    );
    expect(wrapper.container.querySelector('#isSuccess')?.textContent).equal(
      state.isSuccess ? 'true' : 'false'
    );
    expect(wrapper.container.querySelector('#isError')?.textContent).equal(
      state.isError ? 'true' : 'false'
    );
    expect(wrapper.container.querySelector('#error')?.textContent).equal(
      state.error ? state.error.message : 'null'
    );
    expect(wrapper.container.querySelector('#querySuggestions')?.children.length).equal(
      state.querySuggestions.length
    );
    state.querySuggestions.forEach((suggestion, index) => {
      expect(
        wrapper.container.querySelector('#querySuggestions')?.children[index].textContent
      ).equal(suggestion.text);
    });
    expect(wrapper.container.querySelector('#previewResults')?.children.length).equal(
      state.previewResults.length
    );
    state.previewResults.forEach((result, index) => {
      expect(wrapper.container.querySelector('#previewResults')?.children[index].textContent).equal(
        result.id
      );
    });
  };

  const renderState = (state: UseSuggestState<Model>) => {
    return (
      <>
        <span id="status">{state.status}</span>
        <span id="isLoading">{state.isLoading ? 'true' : 'false'}</span>
        <span id="isSuccess">{state.isSuccess ? 'true' : 'false'}</span>
        <span id="isError">{state.isError ? 'true' : 'false'}</span>
        <span id="error">{state.error ? state.error.message : 'null'}</span>
        <ul id="querySuggestions">
          {state.querySuggestions.map((suggestion) => (
            <li key={suggestion.text}>{suggestion.text}</li>
          ))}
        </ul>
        <ul id="previewResults">
          {state.previewResults.map((result) => (
            <li key={result.id}>{result.id}</li>
          ))}
        </ul>
      </>
    );
  };

  it('should return the suggestions for the keyphrase', async () => {
    const TestComponent: React.FC = () => {
      const state = useSuggest<Model>({
        searchIndexId: '1234567890',
        keyphrase: 'running sho',
      });

      return renderState(state);
    };

    suggestServiceStub.resolves({
      querySuggestions: [{ text: 'shoes', queryPlusText: 'running shoes' }],
      previewResults: [{ id: 'doc-1' }],
    });

    const wrapper = render(
      <SitecoreProviderReactContext.Provider value={defaultProviderState}>
        <TestComponent />
      </SitecoreProviderReactContext.Provider>
    );

    assertState(wrapper, {
      querySuggestions: [],
      previewResults: [],
      isLoading: true,
      isSuccess: false,
      isError: false,
      error: null,
      status: 'loading',
      isPreviousData: false,
    });

    expect(
      suggestServiceStub.calledOnceWith({
        searchIndexId: '1234567890',
        keyphrase: 'running sho',
      })
    ).to.be.true;

    await waitFor(() => {
      assertState(wrapper, {
        querySuggestions: [{ text: 'shoes', queryPlusText: 'running shoes' }],
        previewResults: [{ id: 'doc-1' }],
        isLoading: false,
        isSuccess: true,
        isError: false,
        error: null,
        status: 'success',
        isPreviousData: false,
      });
    });
  });

  it('should send the locale when provided', async () => {
    const TestComponent: React.FC = () => {
      const state = useSuggest<Model>({
        searchIndexId: '1234567890',
        keyphrase: 'sho',
        locale: 'fr-FR',
      });

      return renderState(state);
    };

    suggestServiceStub.resolves({ querySuggestions: [], previewResults: [] });

    render(
      <SitecoreProviderReactContext.Provider value={defaultProviderState}>
        <TestComponent />
      </SitecoreProviderReactContext.Provider>
    );

    expect(
      suggestServiceStub.calledOnceWith({
        searchIndexId: '1234567890',
        keyphrase: 'sho',
        locale: 'fr-FR',
      })
    ).to.be.true;
  });

  it('should not request suggestions when the keyphrase is empty', async () => {
    const TestComponent: React.FC = () => {
      const state = useSuggest<Model>({
        searchIndexId: '1234567890',
        keyphrase: '   ',
      });

      return renderState(state);
    };

    const wrapper = render(
      <SitecoreProviderReactContext.Provider value={defaultProviderState}>
        <TestComponent />
      </SitecoreProviderReactContext.Provider>
    );

    expect(suggestServiceStub.called).to.be.false;

    assertState(wrapper, {
      querySuggestions: [],
      previewResults: [],
      isLoading: false,
      isSuccess: false,
      isError: false,
      error: null,
      status: 'idle',
      isPreviousData: false,
    });
  });

  it('should reset the suggestions when the keyphrase is cleared', async () => {
    const TestComponent: React.FC = () => {
      const [keyphrase, setKeyphrase] = useState('sho');
      const state = useSuggest<Model>({
        searchIndexId: '1234567890',
        keyphrase,
      });

      return (
        <>
          <button id="clear" onClick={() => setKeyphrase('')}>
            Clear
          </button>
          {renderState(state)}
        </>
      );
    };

    suggestServiceStub.resolves({
      querySuggestions: [{ text: 'shoes', queryPlusText: 'shoes' }],
      previewResults: [],
    });

    const wrapper = render(
      <SitecoreProviderReactContext.Provider value={defaultProviderState}>
        <TestComponent />
      </SitecoreProviderReactContext.Provider>
    );

    await waitFor(() => {
      expect(wrapper.container.querySelector('#querySuggestions')?.children.length).equal(1);
    });

    fireEvent.click(wrapper.container.querySelector('#clear') as Element);

    await waitFor(() => {
      assertState(wrapper, {
        querySuggestions: [],
        previewResults: [],
        isLoading: false,
        isSuccess: false,
        isError: false,
        error: null,
        status: 'idle',
        isPreviousData: false,
      });
    });

    expect(suggestServiceStub.calledOnce).to.be.true;
  });

  it('should not automatically request suggestions when disabled', async () => {
    const TestComponent: React.FC = () => {
      const [enabled, setEnabled] = useState(false);
      const state = useSuggest<Model>({
        searchIndexId: '1234567890',
        keyphrase: 'sho',
        enabled,
      });

      return (
        <>
          <button id="enable" onClick={() => setEnabled(true)}>
            Enable
          </button>
          {renderState(state)}
        </>
      );
    };

    suggestServiceStub.resolves({
      querySuggestions: [{ text: 'shoes', queryPlusText: 'shoes' }],
      previewResults: [],
    });

    const wrapper = render(
      <SitecoreProviderReactContext.Provider value={defaultProviderState}>
        <TestComponent />
      </SitecoreProviderReactContext.Provider>
    );

    expect(suggestServiceStub.called).to.be.false;

    fireEvent.click(wrapper.container.querySelector('#enable') as Element);

    await waitFor(() => {
      assertState(wrapper, {
        querySuggestions: [{ text: 'shoes', queryPlusText: 'shoes' }],
        previewResults: [],
        isLoading: false,
        isSuccess: true,
        isError: false,
        error: null,
        status: 'success',
        isPreviousData: false,
      });
    });
  });

  it('should return an error state when the request fails', async () => {
    const TestComponent: React.FC = () => {
      const state = useSuggest<Model>({
        searchIndexId: '1234567890',
        keyphrase: 'sho',
      });

      return renderState(state);
    };

    suggestServiceStub.rejects(new Error('HTTP 502 Bad Gateway'));

    const wrapper = render(
      <SitecoreProviderReactContext.Provider value={defaultProviderState}>
        <TestComponent />
      </SitecoreProviderReactContext.Provider>
    );

    await waitFor(() => {
      assertState(wrapper, {
        querySuggestions: [],
        previewResults: [],
        isLoading: false,
        isSuccess: false,
        isError: true,
        error: new Error('HTTP 502 Bad Gateway'),
        status: 'error',
        isPreviousData: false,
      });
    });
  });

  it('should return an error state when the search index ID is not provided', async () => {
    const TestComponent: React.FC = () => {
      const state = useSuggest<Model>({
        searchIndexId: '',
        keyphrase: 'sho',
      });

      return renderState(state);
    };

    const wrapper = render(
      <SitecoreProviderReactContext.Provider value={defaultProviderState}>
        <TestComponent />
      </SitecoreProviderReactContext.Provider>
    );

    expect(suggestServiceStub.called).to.be.false;

    assertState(wrapper, {
      querySuggestions: [],
      previewResults: [],
      isLoading: false,
      isSuccess: false,
      isError: true,
      error: new Error('useSuggest: searchIndexId is required when initializing the hook'),
      status: 'error',
      isPreviousData: false,
    });
  });

  it('should keep the previous suggestions while loading when keepPreviousData is set', async () => {
    const TestComponent: React.FC = () => {
      const [keyphrase, setKeyphrase] = useState('sho');
      const state = useSuggest<Model>({
        searchIndexId: '1234567890',
        keyphrase,
        keepPreviousData: true,
      });

      return (
        <>
          <button id="type" onClick={() => setKeyphrase('shoe')}>
            Type
          </button>
          <span id="isPreviousData">{state.isPreviousData ? 'true' : 'false'}</span>
          {renderState(state)}
        </>
      );
    };

    suggestServiceStub
      .onFirstCall()
      .resolves({ querySuggestions: [{ text: 'shoes', queryPlusText: 'shoes' }], previewResults: [] });
    suggestServiceStub
      .onSecondCall()
      .resolves({ querySuggestions: [{ text: 'shoelace', queryPlusText: 'shoelace' }], previewResults: [] });

    const wrapper = render(
      <SitecoreProviderReactContext.Provider value={defaultProviderState}>
        <TestComponent />
      </SitecoreProviderReactContext.Provider>
    );

    await waitFor(() => {
      expect(wrapper.container.querySelector('#status')?.textContent).equal('success');
    });

    fireEvent.click(wrapper.container.querySelector('#type') as Element);

    assertState(wrapper, {
      querySuggestions: [{ text: 'shoes', queryPlusText: 'shoes' }],
      previewResults: [],
      isLoading: true,
      isSuccess: false,
      isError: false,
      error: null,
      status: 'loading',
      isPreviousData: true,
    });
    expect(wrapper.container.querySelector('#isPreviousData')?.textContent).equal('true');

    await waitFor(() => {
      assertState(wrapper, {
        querySuggestions: [{ text: 'shoelace', queryPlusText: 'shoelace' }],
        previewResults: [],
        isLoading: false,
        isSuccess: true,
        isError: false,
        error: null,
        status: 'success',
        isPreviousData: false,
      });
    });
  });
});
