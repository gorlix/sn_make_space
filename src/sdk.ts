/**
 * Thin typed facade over `sn-plugin-lib`.
 *
 * The SDK's own type declarations annotate many calls as
 * `Promise<Object | null | undefined>` even though at runtime they resolve an
 * `APIResponse<T>` (the JSDoc in the .d.ts says so). These wrappers restore the
 * real shape so callers get proper type narrowing on `success`/`result` instead
 * of fighting `Object`. Keep all such casts here, in one place.
 */
import {PluginCommAPI, PluginFileAPI, PluginManager} from 'sn-plugin-lib';

import type {Rect} from './makeSpace';

/** Runtime shape every async SDK call resolves to. */
export type ApiResponse<T> = {
  success: boolean;
  result: T | null;
  error?: {code?: number; message: string} | null;
};

export type Size = {width: number; height: number};

/** Cast the loosely-typed SDK promise back to its real `APIResponse<T>`. */
const typed = <T>(p: unknown) =>
  p as Promise<ApiResponse<T> | null | undefined>;

export const getCurrentFilePath = () =>
  typed<string>(PluginCommAPI.getCurrentFilePath());

export const getCurrentPageNum = () =>
  typed<number>(PluginCommAPI.getCurrentPageNum());

export const getPageSize = (notePath: string, page: number) =>
  typed<Size>(PluginFileAPI.getPageSize(notePath, page));

export const lassoElements = (rect: Rect) =>
  typed<boolean>(PluginCommAPI.lassoElements(rect));

export const setLassoBoxState = (state: number) =>
  typed<boolean>(PluginCommAPI.setLassoBoxState(state));

export const closePluginView = (): Promise<unknown> =>
  PluginManager.closePluginView() as Promise<unknown>;
