import React from 'react'

type Props = {
  children: React.ReactNode
}

type State = {
  error?: Error
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info)
  }

  reset = (): void => {
    this.setState({ error: undefined })
  }

  reload = (): void => {
    window.location.reload()
  }

  render(): React.ReactNode {
    if (this.state.error) {
      // ErrorBoundary は I18nProvider 外で発火し得るため固定バイリンガルにする。
      return (
        <div className="error-boundary">
          <h2>UI Error / UIエラーが発生しました</h2>
          <pre>{this.state.error.message}</pre>
          <details>
            <summary>Stack trace / スタックトレース</summary>
            <pre>{this.state.error.stack}</pre>
          </details>
          <div className="error-boundary-actions">
            <button onClick={this.reset}>Reset / 状態をリセット</button>
            <button onClick={this.reload}>Reload / リロード</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
