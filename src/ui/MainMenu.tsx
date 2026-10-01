interface MainMenuProps {
  onPlay: () => void
  onOptions: () => void
}

const CONTROLS: readonly [keys: string, action: string][] = [
  ['W / ↑', 'Sail forward'],
  ['A D / ← →', 'Turn left / right'],
  ['Space', 'Front cannon'],
  ['Q / E', 'Left / right broadside'],
  ['Esc / P', 'Pause'],
]

export function MainMenu({ onPlay, onOptions }: MainMenuProps) {
  return (
    <main className="screen">
      <div className="panel menu-panel">
        <div className="menu-actions">
          <h1 className="title">
            <img src="/png/default/ui/menu/title_pirate_battle.png" alt="Pirate Battle" />
          </h1>
          <p className="tagline">Set sail. Take command.</p>

          <button type="button" className="btn btn-primary" onClick={onPlay} autoFocus>
            Play
          </button>
          <button type="button" className="btn btn-primary" onClick={onOptions}>
            Options
          </button>
        </div>

        <section className="controls" aria-labelledby="controls-title">
          <h2 id="controls-title">Controls</h2>
          <dl>
            {CONTROLS.map(([keys, action]) => (
              <div key={keys}>
                <dt>{keys}</dt>
                <dd>{action}</dd>
              </div>
            ))}
          </dl>
          <p className="hint">On touch screens, play in landscape: drag the joystick to sail, tap the buttons to fire.</p>
        </section>
      </div>
    </main>
  )
}
