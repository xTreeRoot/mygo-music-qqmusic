// Exercise the committed release bundle with the same MoeJS/Web APIs as MB desktop.
package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/MoeForge/moejs"
	"github.com/MoeForge/moejs/eventloop"
	"github.com/MoeForge/moejs/webapi"
)

func must(e error) {
	if e != nil {
		panic(e)
	}
}
func main() {
	b, e := os.ReadFile(os.Args[1])
	must(e)
	scenario, e := os.ReadFile(os.Args[2])
	must(e)
	rt := moejs.NewRuntime(moejs.Options{MemoryLimit: 256 << 20})
	loop, e := eventloop.New(rt, eventloop.Options{})
	must(e)
	api, e := webapi.Install(loop, webapi.Options{})
	must(e)
	defer api.Close()
	setup, e := moejs.CompileScript("host-fixture.js", string(scenario))
	must(e)
	must(loop.Run(func(rt *moejs.Runtime) error { _, e := rt.RunScript(setup); return e }))
	mod, e := moejs.Compile("plugin.js", string(b))
	must(e)
	must(loop.Run(func(rt *moejs.Runtime) error { return rt.Load(mod) }))
	for _, tc := range []struct{ name, args string }{{"search", `{"query":"fixture","kind":"tracks"}`}, {"search", `{"query":"fixture","kind":"tracks","offset":1}`}, {"lyrics", `{"id":"song1"}`}, {"stream", `{"id":"song1","quality":"standard"}`}, {"signIn", `{}`}, {"signOut", `{}`}, {"account", `{}`}, {"signIn", `{}`}} {
		var args map[string]any
		must(json.Unmarshal([]byte(tc.args), &args))
		var p moejs.Value
		must(loop.Run(func(rt *moejs.Runtime) error {
			fn, ok := rt.Export(tc.name)
			if !ok {
				return fmt.Errorf("missing %s", tc.name)
			}
			v, e := rt.FromGo(args)
			if e != nil {
				return e
			}
			p, e = rt.CallFunction(fn, moejs.Undefined(), v)
			return e
		}))
		state, v, ok := moejs.PromiseResult(p)
		if ok {
			if state != moejs.PromiseFulfilled {
				panic(tc.name + ": " + v.String())
			}
		} else {
			v = p
		}
		must(rt.SetGlobal("actual", v))
		checks := map[string]string{"search": `if(actual.tracks[0].duration!==123000||!actual.tracks[0].id.startsWith('song'))throw Error('search');`, "lyrics": `if(actual.lrc!=='[00:01.00]中文歌词🎵')throw Error('lyrics');`, "stream": `if(actual.type!=='mp3'||!actual.url.endsWith('fixture.mp3'))throw Error('stream');`, "signIn": `if(actual.id!=='1152921504606846976')throw Error('account id');`, "account": `if(actual!==null)throw Error('logout');`, "signOut": `if(!saved.get('qqmusic.auth.v1')||saved.get('qqmusic.active.v1')!==false)throw Error('retained state');`}
		check, e := moejs.CompileScript("assert.js", checks[tc.name])
		must(e)
		_, e = rt.RunScript(check)
		must(e)
	}
	fmt.Println("PASS desktop MoeJS: shipping bundle/search/paging/UTF-8/audio/retained-session validation")
}
