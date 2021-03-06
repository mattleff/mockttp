import * as zlib from 'zlib';

import { getLocal, getStandalone, getRemote, CompletedRequest } from "../..";
import { expect, fetch, nodeOnly, getDeferred } from "../test-utils";
import { CompletedResponse } from "../../dist/types";

describe("Request subscriptions", () => {
    describe("with a local server", () => {
        let server = getLocal();

        beforeEach(() => server.start());
        afterEach(() => server.stop());

        it("should notify with request details & body when a request is ready", async () => {
            let seenRequestPromise = getDeferred<CompletedRequest>();
            await server.on('request', (r) => seenRequestPromise.resolve(r));

            fetch(server.urlFor("/mocked-endpoint"), { method: 'POST', body: 'body-text' });

            let seenRequest = await seenRequestPromise;
            expect(seenRequest.method).to.equal('POST');
            expect(seenRequest.hostname).to.equal('localhost');
            expect(seenRequest.url).to.equal('/mocked-endpoint');
            expect(seenRequest.body.text).to.equal('body-text');
        });
    });

    nodeOnly(() => {
        describe("with a remote client", () => {
            let standalone = getStandalone();
            let client = getRemote();

            before(() => standalone.start());
            after(() => standalone.stop());

            beforeEach(() => client.start());
            afterEach(() => client.stop());

            it("should notify with request details after a request is made", async () => {
                let seenRequestPromise = getDeferred<CompletedRequest>();
                await client.on('request', (r) => seenRequestPromise.resolve(r));

                fetch(client.urlFor("/mocked-endpoint"), { method: 'POST', body: 'body-text' });

                let seenRequest = await seenRequestPromise;
                expect(seenRequest.method).to.equal('POST');
                expect(seenRequest.url).to.equal('/mocked-endpoint');
                expect(seenRequest.body.text).to.equal('body-text');
            });
        });
    });
});

describe("Response subscriptions", () => {
    let server = getLocal();

    beforeEach(() => server.start());
    afterEach(() => server.stop());

    it("should notify with response details & body when a response is completed", async () => {
        server.get('/mocked-endpoint').thenReply(200, 'Mock response', {
            'x-extra-header': 'present'
        });

        let seenResponsePromise = getDeferred<CompletedResponse>();
        await server.on('response', (r) => seenResponsePromise.resolve(r));

        fetch(server.urlFor("/mocked-endpoint"));

        let seenResponse = await seenResponsePromise;
        expect(seenResponse.statusCode).to.equal(200);
        expect(seenResponse.headers['x-extra-header']).to.equal('present');
        expect(seenResponse.body.text).to.equal('Mock response');
    });

    it("should expose ungzipped bodies as .text", async () => {
        const body = zlib.gzipSync('Mock response');

        server.get('/mocked-endpoint').thenReply(200, body, {
            'content-encoding': 'gzip'
        });

        let seenResponsePromise = getDeferred<CompletedResponse>();
        await server.on('response', (r) => seenResponsePromise.resolve(r));

        fetch(server.urlFor("/mocked-endpoint"));

        let seenResponse = await seenResponsePromise;
        expect(seenResponse.statusCode).to.equal(200);
        expect(seenResponse.body.text).to.equal('Mock response');
    });

    it("should expose un-deflated bodies as .text", async () => {
        const body = zlib.deflateSync('Mock response');

        server.get('/mocked-endpoint').thenReply(200, body, {
            'content-encoding': 'deflate'
        });

        let seenResponsePromise = getDeferred<CompletedResponse>();
        await server.on('response', (r) => seenResponsePromise.resolve(r));

        fetch(server.urlFor("/mocked-endpoint"));

        let seenResponse = await seenResponsePromise;
        expect(seenResponse.statusCode).to.equal(200);
        expect(seenResponse.body.text).to.equal('Mock response');
    });

    it("should expose un-raw-deflated bodies as .text", async () => {
        const body = zlib.deflateRawSync('Mock response');

        server.get('/mocked-endpoint').thenReply(200, body, {
            'content-encoding': 'deflate'
        });

        let seenResponsePromise = getDeferred<CompletedResponse>();
        await server.on('response', (r) => seenResponsePromise.resolve(r));

        fetch(server.urlFor("/mocked-endpoint"));

        let seenResponse = await seenResponsePromise;
        expect(seenResponse.statusCode).to.equal(200);
        expect(seenResponse.body.text).to.equal('Mock response');
    });

    it("should include an id that matches the request event", async () => {
        server.get('/mocked-endpoint').thenReply(200);

        let seenRequestPromise = getDeferred<CompletedRequest>();
        let seenResponsePromise = getDeferred<CompletedResponse>();

        await Promise.all([
            server.on('request', (r) => seenRequestPromise.resolve(r)),
            server.on('response', (r) => seenResponsePromise.resolve(r))
        ]);

        fetch(server.urlFor("/mocked-endpoint"));

        let seenResponse = await seenResponsePromise;
        let seenRequest = await seenRequestPromise;

        expect(seenRequest.id).to.be.a('string');
        expect(seenRequest.id).to.equal(seenResponse.id);
    });
});