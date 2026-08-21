"use client";

import { Component } from "react";

export default class MapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Map failed to render:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="map-loading">
          the map couldn&rsquo;t load — try refreshing the page.
        </div>
      );
    }
    return this.props.children;
  }
}
