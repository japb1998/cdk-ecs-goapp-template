package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/honeycombio/honeycomb-opentelemetry-go"
	"github.com/honeycombio/otel-config-go/otelconfig"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.opentelemetry.io/otel"
	oteltrace "go.opentelemetry.io/otel/trace"
)

var svcName = os.Getenv("OTEL_SERVICE_NAME")

func main() {
	// enable multi-span attributes
	bsp := honeycomb.NewBaggageSpanProcessor()

	// use honeycomb distro to setup OpenTelemetry SDK
	otelShutdown, err := otelconfig.ConfigureOpenTelemetry(
		otelconfig.WithSpanProcessor(bsp),
	)
	if err != nil {
		log.Fatalf("error setting up OTel SDK - %e", err)
	}
	defer otelShutdown()

	r := gin.Default()

	r.Use(otelgin.Middleware(svcName))
	r.GET("/", func(ctx *gin.Context) {
		tracer := otel.Tracer(svcName)
		_, span := tracer.Start(ctx.Request.Context(), "continuation", oteltrace.WithTimestamp(time.Now()), oteltrace.WithAttributes())
		defer span.End()
		ctx.JSON(http.StatusOK, gin.H{
			"healthy": true,
		})

	})

	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
