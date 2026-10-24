"""Stage the supplied APP archive as indexed, read-only documents for publication."""
import json
import re
import uuid
import zipfile
from pathlib import Path

ZIP = Path("source-archive/Prestacao_de_Contas.zip")
OUTPUT = Path("dist/public-app-files")
MANIFEST = Path("dist/server/seeded.js")
MIME = {
    "pdf": "application/pdf", "jpeg": "image/jpeg", "jpg": "image/jpeg",
    "png": "image/png",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def classify(path, filename):
    lower = (path + "/" + filename).lower()
    if "/sicoob/" in lower:
        program = "SICOOB"
    elif "educacao_conectada" in lower or "03_qualidade_" in lower:
        program = "Educacao_Conectada"
    elif "/pdde/" in lower or "ventilador_pdde" in lower or "mapa_cotacao_ventilador" in lower:
        program = "PDDE_Basico"
    else:
        program = "APP"
    base = filename.lower()
    if "extrato" in base:
        kind = "extrato"
    elif "demonstrativo" in base:
        kind = "demonstrativo"
    elif "mapa_cotacao" in base or "consolidacao_pesquisa" in base:
        kind = "pesquisa_precos"
    elif "ata_" in base or "_ata_" in base:
        kind = "ata"
    elif "resolucao" in base:
        kind = "resolucao"
    elif "parecer" in base:
        kind = "parecer"
    elif "cotacao" in base:
        kind = "cotacao"
    elif "nfe_" in base or "nota_fiscal" in base:
        kind = "nota_fiscal"
    elif "recibo" in base:
        kind = "recibo"
    elif "comprovante" in base:
        kind = "comprovante"
    else:
        kind = "outro"
    return program, kind


def placement(path, filename, program, kind):
    lower_path = path.lower()
    lower_name = filename.lower()
    if kind == "pesquisa_precos":
        section, folder = "financeiro", "Pesquisa de preços"
    elif "/01_juridico_e_administrativo/" in lower_path:
        section = "juridico"
        folder = "Atas de reuniões e assembleias" if "/atas_de_reunioes_e_assembleias/" in lower_path else "Estatuto da APP"
    elif "/04_pareceres_aprovacoes/" in lower_path:
        section, folder = "pareceres", "Pareceres e aprovações"
    elif "/03_transparencia_familias/" in lower_path:
        section, folder = "transparencia", "Transparência para famílias"
    else:
        section = "financeiro"
        folder = ("Extratos e conciliações" if "/04_extratos_e_conciliacoes/" in lower_path
                  else "Demonstrativos" if kind == "demonstrativo"
                  else "Despesas de capital" if "/capital/" in lower_path
                  else "Despesas de custeio" if "/custeio/" in lower_path
                  else "Semestre consolidado" if "semestre_consolidado" in lower_path
                  else "Movimentação mensal")
    bank = "BB" if section == "financeiro" and program in ("PDDE_Basico", "PDDE_Qualidade", "Educacao_Conectada") else "SICOOB" if program == "SICOOB" else ""
    if kind == "extrato":
        statement_type = ("investimentos" if "investimento" in lower_name
                          else "conta_corrente" if "conta_corrente" in lower_name
                          else "consolidado" if "consolidado" in lower_name
                          else "outro")
    else:
        statement_type = ""
    return section, folder, bank, statement_type


def humanize(filename, kind, program):
    if "01_a_06" in filename:
        return ("Extrato" if kind == "extrato" else "Demonstrativo") + " consolidado (janeiro a junho)"
    stem = filename
    while Path(stem).suffix.lower() in (".pdf", ".docx", ".xlsx", ".jpeg", ".jpg", ".png"):
        stem = Path(stem).stem
    stem = re.sub(r"^\d{4}[-_]\d{2}(?:[-_]\d{2})?[-_]", "", stem)
    stem = re.sub(r"^\d{4}[-_]", "", stem)
    stem = re.sub(r"^(Extrato|Ata|Cotacao|Mapa_Cotacao|Comprovante|Recibo)[-_]", "", stem, flags=re.I)
    stem = stem.replace("_", " ").replace("-", " ")
    stem = re.sub(r"\s+", " ", stem).strip()
    replacements = {
        "Educacao Conectada": "Educação Conectada",
        "Basico": "Básico", "Honorarios": "Honorários",
        "Doacao": "Doação", "Aprovacao": "Aprovação",
        "Regularizacao": "Regularização", "Contabeis": "Contábeis",
        "Demonstrativo Consolidado": "Demonstrativo consolidado",
    }
    for old, new in replacements.items():
        stem = stem.replace(old, new)
    stem = re.sub(r"\bassinad[oa]\s+assinad[oa]\b", "assinado", stem, flags=re.I)
    if kind == "extrato":
        stem = stem.replace(" BB PDDE Educação Conectada", " BB").replace(" BB PDDE Básico", " BB")
    if not stem:
        stem = kind.capitalize()
    return stem[:200]


def clean(value):
    import unicodedata
    value = unicodedata.normalize("NFD", value)
    value = "".join(c for c in value if unicodedata.category(c) != "Mn")
    return re.sub(r"_+", "_", re.sub(r"[^A-Za-z0-9]+", "_", value)).strip("_")[:72] or "Documento"


def download_name(record, ext):
    part = record["competence"] or str(record["year"] or "Sem_data")
    label = {
        "ata": "Ata", "extrato": "Extrato", "resolucao": "Resolucao",
        "comprovante": "Comprovante", "cotacao": "Cotacao", "pesquisa_precos": "Pesquisa_Preco",
        "nota_fiscal": "Nota_Fiscal", "recibo": "Recibo", "demonstrativo": "Demonstrativo",
        "parecer": "Parecer", "outro": "Documento",
    }[record["kind"]]
    return "_".join(map(clean, (part, record["program"], label, record["title"]))) + "." + ext


def main():
    if not ZIP.is_file():
        # v39: o acervo inicial da APP foi retirado a pedido da direção.
        # Sem o ZIP de origem, o site é compilado sem documentos iniciais.
        OUTPUT.mkdir(parents=True, exist_ok=True)
        MANIFEST.parent.mkdir(exist_ok=True)
        MANIFEST.write_text("export const seededDocuments = [];\n")
        print("Sem acervo inicial da APP: 0 arquivos indexados.")
        return
    OUTPUT.mkdir(parents=True, exist_ok=True)
    records = []
    with zipfile.ZipFile(ZIP) as source:
        for member in source.infolist():
            if member.is_dir():
                continue
            path = member.filename
            original = Path(path).name
            ext = original.rsplit(".", 1)[-1].lower()
            if ext not in MIME:
                raise ValueError(f"Formato não suportado: {path}")
            if member.file_size > 20 * 1024 * 1024:
                raise ValueError(f"Arquivo acima de 20 MB: {path}")
            identity = str(uuid.uuid5(uuid.NAMESPACE_URL, "cei-app/" + path))
            month = re.search(r"20\d{2}[-_](0[1-9]|1[0-2])", original)
            if not month:
                month = re.search(r"/(20\d{2})/(0[1-9]|1[0-2])[_/]", path)
            competence = month.group(0).replace("_", "-").replace("/", "-") if month else ""
            if competence and not re.fullmatch(r"20\d{2}-\d{2}", competence):
                competence = ""
            if "01_a_06" in path:
                competence = "2026-06"
            day = re.match(r"(20\d{2})-(\d{2})-(\d{2})", original)
            date = day.group(0) if day else None
            year = int(date[:4] if date else competence[:4]) if date or competence else None
            program, kind = classify(path, original)
            section, folder, bank, statement_type = placement(path, original, program, kind)
            title = humanize(original, kind, program)
            key = f"/public-app-files/{identity}.{ext}"
            data = source.read(member)
            if len(data) != member.file_size:
                raise ValueError(f"Falha de leitura: {path}")
            (OUTPUT / f"{identity}.{ext}").write_bytes(data)
            record = {
                "id": identity, "seeded": True, "kind": kind, "program": program,
                "section": section, "folder": folder, "bank": bank,
                "statementType": statement_type,
                "year": year, "competence": competence, "date": date,
                "title": title, "sourcePath": path,
                "file": {
                    "key": key, "name": "", "originalName": original,
                    "mime": MIME[ext], "size": len(data),
                },
            }
            record["file"]["name"] = download_name(record, ext)
            records.append(record)
    if len(records) != 49 or len({r["id"] for r in records}) != 49:
        raise ValueError(f"Esperados 49 documentos únicos; encontrados {len(records)}")
    MANIFEST.parent.mkdir(exist_ok=True)
    MANIFEST.write_text("export const seededDocuments = " + json.dumps(records, ensure_ascii=False) + ";\n")
    summary = {}
    for record in records:
        key = (record["program"], record["kind"])
        summary[key] = summary.get(key, 0) + 1
    print(f"{len(records)} arquivos indexados ({sum(r['file']['size'] for r in records)} bytes).")
    for key, count in sorted(summary.items()):
        print(f"{key[0]} / {key[1]}: {count}")


if __name__ == "__main__":
    main()
