import asyncio, json
from playwright.async_api import async_playwright
Q = [
 # 1 « Faisons connaissance » : Haiku cherche dans les contacts (outil local) puis pose sa question
 {"content":[{"type":"tool_use","id":"a1","name":"chercher_contact","input":{"nom":"Julie"}}],"stop_reason":"tool_use","usage":{"input_tokens":900,"output_tokens":40}},
 {"content":[{"type":"text","text":"Très bien, monsieur. Julie Martin vous écrit souvent. Qui est-ce pour vous ?"}],"stop_reason":"end_turn","usage":{"input_tokens":950,"output_tokens":30}},
 # 2 sa réponse : une fiche sans texte, puis la question suivante (l'entretien enchaîne)
 {"content":[{"type":"tool_use","id":"b1","name":"fiche_proche","input":{"nom":"Julie Martin","surnom":"Juju","lien":"sa sœur aînée","categorie":"famille","anniversaire":"12/03","telephone":"06 11 22 33 44"}}],"stop_reason":"tool_use","usage":{"input_tokens":1000,"output_tokens":60}},
 {"content":[{"type":"text","text":"C'est noté. Et votre autre sœur ?"}],"stop_reason":"end_turn","usage":{"input_tokens":1000,"output_tokens":20}},
 # 3 « on arrête »
 {"content":[{"type":"text","text":"Une fiche de faite, monsieur. Nous reprendrons quand vous voudrez."},{"type":"tool_use","id":"c1","name":"fin_entretien","input":{}}],"stop_reason":"tool_use","usage":{"input_tokens":1000,"output_tokens":20}},
 # 4 Sonnet, ensuite
 {"content":[{"type":"text","text":"J'appelle Julie, monsieur."}],"stop_reason":"end_turn","usage":{"input_tokens":3000,"output_tokens":20}},
]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":412,"height":900}, device_scale_factor=2); errors=[]; calls=[]
        pg.on("pageerror", lambda e: errors.append(str(e)))
        async def route(r):
            u=r.request.url
            if "api.anthropic.com" in u:
                calls.append(json.loads(r.request.post_data))
                return await r.fulfill(status=200, content_type="application/json", body=json.dumps(Q[len(calls)-1] if len(calls)<=len(Q) else Q[-1]))
            if u.startswith("file://"): return await r.continue_()
            return await r.fulfill(status=200, content_type="application/json", body="{}")
        await pg.route("**/*", route)
        await pg.add_init_script("""localStorage.setItem('zap_cfg', JSON.stringify({key:'sk-test', cvFlux:false, vSay:'0', jvParle:false}));""")
        await pg.goto("file:///home/claude/copilote/index.html"); await pg.wait_for_timeout(1800)
        await pg.evaluate("""(async()=>{ MEM.tok='A'.repeat(43); MEM.key = await crypto.subtle.generateKey({name:'AES-GCM',length:256}, false, ['encrypt','decrypt']); })()""")
        r={}
        await pg.evaluate("for (let i=0;i<5;i++) jvFreqNote('Julie Martin'); jvFreqNote('Paul'); jvFreqNote('+33 6 12 34 56 78')")
        r["pistes"]=await pg.evaluate("jvFcPistes()")
        r["demande"]=await pg.evaluate("[jvFcDemande('Faisons connaissance.'), jvFcDemande('Nestor, apprends à me connaître'), jvFcDemande('on fait connaissance ?'), jvFcDemande('je connais ce resto')]")
        await pg.evaluate("cvSend('Faisons connaissance.', {})"); await pg.wait_for_timeout(1500)
        c1=calls[0]
        r["appel1"]={"model":c1["model"],"outils":[t["name"] for t in c1["tools"]],"consigne":"Faisons connaissance" in json.dumps(c1["system"],ensure_ascii=False),"proches_pistes":"<pistes>" in c1["messages"][-1]["content"] and "Julie Martin" in c1["messages"][-1]["content"],"sans_contexte":"<contexte>" not in c1["messages"][-1]["content"],"pas_effort":"output_config" not in c1}
        r["appel2_resultat_contact"]=json.dumps(calls[1]["messages"][-1],ensure_ascii=False)[:160]
        r["fc_on"]=await pg.evaluate("jvFcOn()")
        await pg.evaluate("cvSend('Julie c est ma grande soeur, je l appelle Juju, son anniversaire c est le 12 mars', {})"); await pg.wait_for_timeout(1500)
        r["nb_appels_apres_reponse"]=len(calls)
        r["appel4_haiku"]=calls[3]["model"]
        r["blocs_retires_ancien_tour"]=sum(1 for m in calls[3]["messages"] if isinstance(m["content"],str) and "<pistes>" in m["content"])
        r["fiche"]=await pg.evaluate("jvProches().map(i=>[i.t,i.d,JSON.stringify(i.an)])")
        r["findContact_surnom"]=await pg.evaluate("JSON.stringify(findContact('Juju'))")
        r["findContact_ma_soeur"]=await pg.evaluate("JSON.stringify(jvProcheContact('ma Juju'))")
        r["anniv"]=await pg.evaluate("jvAnnivs().filter(a=>a.nom==='Juju').length")
        r["pistes_apres"]=await pg.evaluate("jvFcPistes()")
        r["conso"]=await pg.evaluate("JSON.stringify(cvMonth().par)")
        await pg.evaluate("cvSend('On arrête là', {})"); await pg.wait_for_timeout(1200)
        r["fc_off"]=await pg.evaluate("!jvFcOn()")
        await pg.evaluate("cvSend('Appelle Juju', {})"); await pg.wait_for_timeout(1500)
        c=calls[-1]; last=c["messages"][-1]["content"]
        r["sonnet"]={"model":c["model"],"fiche_dans_outils":"fiche_proche" in [t["name"] for t in c["tools"]],"proches_contexte":"Ses proches" in last and "Juju = Julie Martin" in last,"pas_de_tel_dans_contexte":"06 11" not in last.split("<contexte>")[1] if "<contexte>" in last else None,"consigne_proches":"Ses proches" in json.dumps(c["system"],ensure_ascii=False)}
        # modification : la même personne complétée, pas en double
        r["complete"]=await pg.evaluate("(async()=>{ await jvProcheApply({nom:'Juju', notes:'joue au tennis'}); return jvProches().map(i=>i.t) })()")
        r["ignorer"]=await pg.evaluate("(async()=>{ await jvProcheApply({nom:'Paul', action:'ignorer'}); return jvFcPistes() })()")
        # la page
        await pg.evaluate("openReglages('memoire')"); await pg.wait_for_timeout(400)
        await pg.evaluate("regMemOpen && regMemOpen()") if await pg.evaluate("typeof regMemOpen==='function'") else None
        await pg.wait_for_timeout(400)
        r["page"]=await pg.evaluate("$('cvProches').innerText.slice(0,300)")
        await pg.evaluate("$('cvProches').scrollIntoView()"); await pg.screenshot(path="/tmp/nt/proches.png")
        await pg.evaluate("$('cvPrNom').value='Marc Durand'; $('cvPrSur').value='Marco'; $('cvPrLien').value='ami du golf'; $('cvPrCat').value='golf'; $('cvPrAn').value='05/07'; $('cvPrOk').click()"); await pg.wait_for_timeout(500)
        r["ajout_main"]=await pg.evaluate("jvProches().map(i=>i.pe.nom+'|'+(i.pe.cat||'')+'|'+(i.pe.anniv||''))")
        await pg.evaluate("document.querySelector('[data-pre]').click()"); await pg.wait_for_timeout(200)
        r["edition_prerempli"]=await pg.evaluate("[$('cvPrNom').value, $('cvPrSur').value, $('cvPrAn').value]")
        await pg.evaluate("$('cvPrLien').value='ami du golf depuis 2019'; $('cvPrOk').click()"); await pg.wait_for_timeout(500)
        r["apres_edition"]=await pg.evaluate("jvProches().length")
        await pg.evaluate("const b=document.querySelector('[data-prd]'); b.click(); b.click()"); await pg.wait_for_timeout(500)
        r["apres_oubli"]=await pg.evaluate("jvProches().length")
        r["sous_titre_menu"]=await pg.evaluate("document.querySelector('#regHome [data-p=\"memoire\"]').innerText")
        r["errors"]=errors[:5]
        print(json.dumps(r,ensure_ascii=False,indent=1)); await b.close()
asyncio.run(main())
