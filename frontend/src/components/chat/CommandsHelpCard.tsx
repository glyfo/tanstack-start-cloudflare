/**
 * Commands Help Card
 * Shows available slash commands and their usage
 */

import { Terminal } from 'lucide-react';

interface Command {
  command: string;
  description: string;
  example?: string;
}

const commands: Command[] = [
  {
    command: '/reset',
    description: 'Clear your conversation history and start fresh',
    example: 'Just type /reset and press enter',
  },
  {
    command: '/help',
    description: 'Show this help menu with all available commands',
  },
];

export function CommandsHelpCard() {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
          <Terminal className="w-5 h-5 text-sky-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Available Commands</h3>
          <p className="text-xs text-stone-500">Quick actions you can use</p>
        </div>
      </div>

      {/* Commands List */}
      <div className="space-y-3">
        {commands.map((cmd) => (
          <div key={cmd.command} className="border-l-2 border-sky-200 pl-3">
            <div className="flex items-baseline gap-2 mb-1">
              <code className="text-sm font-mono font-semibold text-sky-600">
                {cmd.command}
              </code>
            </div>
            <p className="text-xs text-stone-600 mb-1">{cmd.description}</p>
            {cmd.example && (
              <p className="text-[10px] text-stone-400 italic">
                {cmd.example}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Footer Tip */}
      <div className="mt-4 pt-4 border-t border-stone-100">
        <p className="text-[10px] text-stone-400">
          <strong>Tip:</strong> You can also use the settings menu (⚙️ icon) to access these features
        </p>
      </div>
    </div>
  );
}
