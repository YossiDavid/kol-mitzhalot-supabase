import { Extension } from "@tiptap/react";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";

import {
  filterSlashCommands,
  type SlashCommand,
  type SlashCommandActions,
} from "./slash-commands";

export type SlashSuggestionRender = NonNullable<
  SuggestionOptions<SlashCommand, SlashCommand>["render"]
>;

interface SlashCommandOptions {
  /** מחזיר את מטפלי התפריט (רכיב React). חייב להיות יציב בין רינדורים */
  render: SlashSuggestionRender;
  actions: SlashCommandActions;
}

const SLASH_PLUGIN_KEY = new PluginKey("slashCommand");

/**
 * תפריט "/" בסגנון Notion, מעל המנגנון הרשמי של TipTap (@tiptap/suggestion).
 * "/" פותח את התפריט בתחילת שורה או אחרי רווח; Esc סוגר (המנגנון מטפל בזה).
 */
export const SlashCommandExtension = Extension.create<SlashCommandOptions>({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommand, SlashCommand>({
        editor: this.editor,
        pluginKey: SLASH_PLUGIN_KEY,
        char: "/",
        items: ({ query }) => filterSlashCommands(query),
        command: ({ editor, range, props }) =>
          props.run({ editor, range, actions: this.options.actions }),
        render: this.options.render,
      }),
    ];
  },
});
