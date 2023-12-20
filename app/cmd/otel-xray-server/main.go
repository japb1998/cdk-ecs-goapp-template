package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.opentelemetry.io/contrib/propagators/aws/xray"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/sdk/trace"
	oteltrace "go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
)

var svcName = os.Getenv("OTEL_SERVICE_NAME")

func main() {
	err := start_xray()
	if err != nil {
		log.Fatalf("Failed to start XRay: %v", err)
		return
	}

	r := gin.Default()
	r.Use(otelgin.Middleware(svcName))
	r.GET("/", func(ctx *gin.Context) {
		tracer := otel.Tracer(otelgin.ScopeName)
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

func start_xray() error {
	ctx := context.Background()

	exporterEndpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if exporterEndpoint == "" {
		exporterEndpoint = "localhost:4317"
	}

	log.Println("Creating new OTLP trace exporter...")
	traceExporter, err := otlptracegrpc.New(ctx, otlptracegrpc.WithInsecure(), otlptracegrpc.WithEndpoint(exporterEndpoint), otlptracegrpc.WithDialOption(grpc.WithBlock()))
	if err != nil {
		log.Fatalf("Failed to create new OTLP trace exporter: %v", err)
		return err
	}

	idg := xray.NewIDGenerator()

	samplerEndpoint := os.Getenv("XRAY_ENDPOINT")
	if samplerEndpoint == "" {
		samplerEndpoint = "http://localhost:2000"
	}
	// endpointUrl, err := url.Parse(samplerEndpoint)

	// res, err := sampler.NewRemoteSampler(ctx, svcName, "ecs", sampler.WithEndpoint(*endpointUrl), sampler.WithSamplingRulesPollingInterval(10*time.Second))
	// if err != nil {
	// 	log.Fatalf("Failed to create new XRay Remote Sampler: %v", err)
	// 	return err
	// }

	// attach remote sampler to tracer provider
	tp := trace.NewTracerProvider(
		trace.WithSampler(trace.AlwaysSample()),
		trace.WithBatcher(traceExporter),
		trace.WithIDGenerator(idg),
	)

	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(xray.Propagator{})
	return nil
}
