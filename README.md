# testyomesh
![dawg](yodawg.png)

## Enough with the memes, what is this?

I've been upgrading [Istio](https://github.com/istio/istio) pretty much since it was born.  I've encountered my fair share of bugs during the upgrade process, and the vast majority are due to nuances in my configursation or environment, rather than obvious bugs in core components.

Therefore, I accept that when testing Istio releases in my environment, I'm going to find issues.  This project is about surfacing those issues as soon as possible.

### How?

Like this:

![architecture](architecture.png)

It basically a bunch of services, with a load tester that generates a variety (about 150) of different types of requests.  It does this by:

 - Calculating each different permutation of request, eg `service1 -> service2 -> service3`, or perhaps `service3 -> service1`
 - Adds in all the different HTTP methods to that mix, eg `service1 -- GET --> service2`, or perhaps `service2 -- PATCH --> service1`
 - Uses a mixture of instant and delayed routes, eg `service1 -- GET /instant --> service3`, or perhaps `service2 -- POST /delayed --> service3`

It's the cardinality of the test that's helped me find way more issues than just bog standard load tests.

### But wait, there's more!

I've hit many-a-bugs causing by rolling deployments, for example when you update your control-plane, and then rolling restart an app, so you have varying proxy versions.  As a result, `testyomesh` has an operator which periodically (between 5 and 10 mins) rolling restarts all the services to create some churn.

## How do I know somethings broken?

Well, I'm presuming you're already monitoring, graphing and alerting on the istio request metrics such as `istio_requests_total{response_code=~"5.*"}`.  So that's on you.

![metrics](metrics.png)

## How do I install it

There's a helm chart in the [./helmfile/charts/testyomesh](./helmfile/charts/testyomesh) folder, or you can get [helmfile](https://github.com/roboll/helmfile), and simply type `helmfile sync` from the `helmfile/` folder.

I'll get around to versioned releases when I have time, until then you probably want to store the latest image in your registry, so:

 - `docker pull stono/testyomesh:latest`
 - `docker test stono/testyomesh:latest you-registry:whatever`

 And then update `helmfile/charts/testyomesh/values.yaml` accordingly.

### How about config?

The things you can currently configure are in [./helmfile/charts/testyomesh/values.yaml](./helmfile/charts/testyomesh/values.yaml]).  The out of the box configuration will give you `2` load test replicas running `30` threads, `3` simple services, and `1` operator.  This will give you around 150 ops/second.
