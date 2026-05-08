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
      return (
        <div className="error-boundary">
          <h2>UIエラーが発生しました</h2>
          <pre>{this.state.error.message}</pre>
          <details>
            <summary>スタックトレース</summary>
            <pre>{this.state.error.stack}</pre>
          </details>
          <div className="error-boundary-actions">
            <button onClick={this.reset}>状態をリセット</button>
            <button onClick={this.reload}>リロード</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
