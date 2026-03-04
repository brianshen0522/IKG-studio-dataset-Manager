"use client";

import { useEffect, useRef } from 'react';
import { useTranslation } from '../_components/LanguageProvider';
import './label-editor.css';

export default function LabelEditorPage() {
  const apiRef = useRef(null);
  const { t, isReady } = useTranslation();

  useEffect(() => {
    if (!isReady) {
      return;
    }
    let active = true;
    import('@/lib/label-editor-ui').then((mod) => {
      if (!active) return;
      apiRef.current = mod;
      if (mod.initLabelEditor) {
        mod.initLabelEditor();
      }
    });
    return () => {
      active = false;
    };
  }, [isReady]);

  useEffect(() => {
    if (apiRef.current?.updateDeleteButton) {
      apiRef.current.updateDeleteButton();
    }
  });

  useEffect(() => {
    if (apiRef.current?.updateSaveButtonState) {
      apiRef.current.updateSaveButtonState();
    }
  }, [t, isReady]);

  const callApi = (method, ...args) => {
    const api = apiRef.current;
    if (!api || typeof api[method] !== 'function') {
      return;
    }
    api[method](...args);
  };

  if (!isReady) {
    return <div style={{ padding: '20px', color: '#aaa' }}>Loading...</div>;
  }

  return (
    <>
      <div className="header">
        <h1>{t('editor.title')}</h1>
        <div className="header-actions">
          <button className="btn btn-secondary" id="prevBtn" onClick={() => callApi('previousImage')}>
            {t('editor.previous')}
          </button>
          <span id="imageCounter" style={{ margin: '0 15px', color: '#aaa' }} />
          <button className="btn btn-secondary" id="nextBtn" onClick={() => callApi('nextImage')}>
            {t('editor.next')}
          </button>
          <button className="btn btn-secondary" onClick={() => callApi('loadImage', true)}>
            {t('editor.reload')}
          </button>
          <button
            className="btn btn-primary"
            id="saveBtn"
            title={t('editor.saveNoChanges')}
            data-tour="editor-save"
            onClick={() => callApi('saveLabels')}
          >
            <span id="saveBtnLabel">{t('editor.saveLabels')}</span>
          </button>
        </div>
      </div>

      <div className="main-container">
        <div className="editor-left">
          <div className="canvas-container" id="canvasContainer" data-tour="editor-canvas">
            <div className="loading" id="loading">
              {t('common.loading')}
            </div>
            <div
              className="error-message"
              id="errorMessage"
              style={{ display: 'none', color: '#dc3545', padding: '20px', textAlign: 'center' }}
            />
            <canvas id="canvas" />
          </div>

          <div className="preview-bar" id="previewBar">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ color: '#aaa', fontSize: '12px' }} id="imagePreviewCount">
                  {t('editor.preview.images')}
                </div>
                <div className="select-mode-actions" id="selectModeActions" style={{ display: 'none' }}>
                  <button className="btn btn-secondary btn-small" onClick={() => callApi('selectAllImages')}>
                    {t('editor.selectMode.selectAll')}
                  </button>
                  <button className="btn btn-secondary btn-small" onClick={() => callApi('deselectAllImages')}>
                    {t('editor.selectMode.deselectAll')}
                  </button>
                  <button className="btn-delete-selected" id="deleteSelectedBtn" onClick={() => callApi('deleteSelectedImages')}>
                    {t('editor.selectMode.deleteSelected', { count: '0' })}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select id="previewSort" className="preview-sort-select" onChange={() => callApi('handlePreviewSortChange')}>
                  <option value="name-asc">{t('editor.preview.nameAsc')}</option>
                  <option value="name-desc">{t('editor.preview.nameDesc')}</option>
                  <option value="created-desc">{t('editor.preview.createdNewest')}</option>
                  <option value="created-asc">{t('editor.preview.createdOldest')}</option>
                </select>
                <button className="btn btn-secondary btn-small" onClick={() => callApi('resetFilterAndSort')}>
                  {t('editor.filter.resetAll')}
                </button>
                <input
                  type="text"
                  id="previewSearch"
                  className="preview-search-input"
                  placeholder={t('editor.preview.searchFilename')}
                  onInput={() => callApi('handlePreviewSearch')}
                />
              </div>
            </div>
            <div className="preview-progress">
              <div className="preview-progress-fill" id="previewProgressFill" />
            </div>
            <div className="image-preview" id="imagePreview" />
          </div>
        </div>

        <div className="sidebar">
          <div className="sidebar-section">
            <h2>{t('editor.imageInfo.title')}</h2>
            <div className="info-field">
              <div className="info-label">{t('editor.imageInfo.filename')}</div>
              <div className="info-value" id="filename">
                -
              </div>
            </div>
            <div className="info-field">
              <div className="info-label">{t('editor.imageInfo.imageSize')}</div>
              <div className="info-value" id="imageSize">
                -
              </div>
            </div>
          </div>

          <div className="sidebar-section" id="obbModeSection" style={{ display: 'none' }}>
            <h2>{t('editor.obbMode.title')}</h2>
            <div className="info-field">
              <div className="info-value" id="obbModeDisplay" style={{ color: '#4ECDC4', fontWeight: 500 }}>
                -
              </div>
            </div>
          </div>

          <div className="sidebar-section">
            <h2>
              {t('editor.selectClass.title')} <span style={{ fontSize: '12px', color: '#aaa' }}>({t('editor.selectClass.hint')})</span>
            </h2>
            <div className="class-selector" id="classSelector" />
          </div>

          <div className="sidebar-section">
            <h2>
              {t('editor.annotations.title')} (<span id="annotationCount">0</span>)
            </h2>
            <div className="annotations-list" id="annotationsList" />
          </div>

          <div className="sidebar-section">
            <h2>{t('editor.display.title')}</h2>
            <div className="line-width-control">
              <label className="filter-label" htmlFor="lineWidthScale">
                {t('editor.display.lineWidth')} <span id="lineWidthScaleValue">66%</span>
              </label>
              <input
                type="range"
                id="lineWidthScale"
                min="0.3"
                max="1.5"
                step="0.05"
                defaultValue="0.66"
                onInput={(event) => callApi('setLineWidthScale', event.target.value)}
              />
            </div>
          </div>

          <div className="sidebar-section filter-section" data-tour="editor-filters">
            <div className="filter-toggle" onClick={() => callApi('toggleFilterSection')}>
              <h2>{t('editor.filter.title')}</h2>
              <span id="filterToggleIcon">▶</span>
            </div>
            <div className="filter-content collapsed" id="filterContent">
              <div className="filter-group">
                <label className="filter-label">{t('editor.filter.imageName')}</label>
                <input
                  type="text"
                  className="filter-input"
                  id="filterName"
                  placeholder={t('editor.filter.searchByFilename')}
                  autoComplete="off"
                  inputMode="text"
                  onInput={() => callApi('applyFiltersDebounced')}
                />
              </div>

              <div className="filter-group">
                <label className="filter-label">{t('editor.filter.hasClasses')}</label>
                <div className="filter-range">
                  <select id="filterClassMode" onChange={() => callApi('applyFilters')}>
                    <option value="any">{t('editor.filter.any')}</option>
                    <option value="none">{t('editor.filter.none')}</option>
                    <option value="only">{t('editor.filter.onlySelected')}</option>
                  </select>
                  <select id="filterClassLogic" onChange={() => callApi('applyFilters')}>
                    <option value="any">{t('editor.filter.matchAny')}</option>
                    <option value="all">{t('editor.filter.matchAll')}</option>
                  </select>
                </div>
                <div className="filter-class-search">
                  <input
                    type="text"
                    id="filterClassSearch"
                    placeholder={t('editor.filter.searchClasses')}
                    autoComplete="off"
                    inputMode="text"
                  />
                </div>
                <div className="filter-class-chips" id="filterClassChips" />
                <div className="filter-checkboxes" id="filterClasses" />
              </div>

              <div className="filter-group">
                <label className="filter-label">{t('editor.filter.labelCount')}</label>
                <div className="filter-range">
                  <input
                    type="number"
                    id="filterMinLabels"
                    placeholder={t('editor.filter.min')}
                    min="0"
                    defaultValue="0"
                    onChange={() => callApi('applyFilters')}
                  />
                  <span>{t('editor.filter.to')}</span>
                  <input
                    type="number"
                    id="filterMaxLabels"
                    placeholder={t('editor.filter.max')}
                    min="0"
                    defaultValue=""
                    onChange={() => callApi('applyFilters')}
                  />
                </div>
              </div>

              <button className="btn-clear-filter" onClick={() => callApi('clearFilters')}>
                {t('editor.filter.clearAll')}
              </button>

              <div className="filter-stats" id="filterStats">
                {t('editor.filter.showingAll')}
              </div>
              <div className="filter-warning" id="filterWarning" style={{ display: 'none' }}>
                {t('editor.filter.minCannotBeGreaterThanMax')}
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="status-bar" id="statusBar">
        <span id="statusBarText">{t('editor.status.ready')}</span>
        <span id="statusBarRight" style={{ opacity: 0.7 }}></span>
      </div>
    </>
  );
}
