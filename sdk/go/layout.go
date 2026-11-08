package orbit360

import "math"

type RectF struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

type LayoutLayerInput struct {
	LayerIndex int  `json:"layerIndex"`
	Rect       Rect `json:"rect"`
}

type LayoutInput struct {
	Canvas        Canvas             `json:"canvas"`
	Viewport      Canvas             `json:"viewport"`
	Fit           string             `json:"fit"`
	DisplayScale  *float64           `json:"displayScale"`
	PortraitScale *float64           `json:"portraitScale"`
	DPR           float64            `json:"dpr"`
	Layers        []LayoutLayerInput `json:"layers"`
}

type LayoutLayer struct {
	LayerIndex int   `json:"layerIndex"`
	Rect       RectF `json:"rect"`
}

type LayoutPlan struct {
	Scale           float64       `json:"scale"`
	DestinationRect RectF         `json:"destinationRect"`
	Layers          []LayoutLayer `json:"layers"`
}

func ComputeLayout(input LayoutInput) LayoutPlan {
	canvasWidth := float64(input.Canvas.Width)
	canvasHeight := float64(input.Canvas.Height)
	viewportWidth := float64(input.Viewport.Width)
	viewportHeight := float64(input.Viewport.Height)
	cover := input.Fit == "cover"
	displayScale := 1.0
	if input.DisplayScale != nil {
		displayScale = *input.DisplayScale
	}
	portraitScale := 1.25
	if input.PortraitScale != nil {
		portraitScale = *input.PortraitScale
	}
	fitScale := math.Min(viewportWidth/canvasWidth, viewportHeight/canvasHeight)
	coverScale := math.Max(viewportWidth/canvasWidth, viewportHeight/canvasHeight)
	base := fitScale
	if cover {
		base = coverScale
	} else if viewportHeight > viewportWidth {
		base *= portraitScale
	}
	scale := base
	if !cover {
		scale *= displayScale
	}
	width := canvasWidth * scale
	height := canvasHeight * scale
	destination := RectF{
		X:      (viewportWidth - width) / 2,
		Y:      (viewportHeight - height) / 2,
		Width:  width,
		Height: height,
	}
	layers := make([]LayoutLayer, 0, len(input.Layers))
	for _, layer := range input.Layers {
		layers = append(layers, LayoutLayer{
			LayerIndex: layer.LayerIndex,
			Rect: RectF{
				X:      destination.X + float64(layer.Rect.X)*scale,
				Y:      destination.Y + float64(layer.Rect.Y)*scale,
				Width:  float64(layer.Rect.Width) * scale,
				Height: float64(layer.Rect.Height) * scale,
			},
		})
	}
	return LayoutPlan{Scale: scale, DestinationRect: destination, Layers: layers}
}
