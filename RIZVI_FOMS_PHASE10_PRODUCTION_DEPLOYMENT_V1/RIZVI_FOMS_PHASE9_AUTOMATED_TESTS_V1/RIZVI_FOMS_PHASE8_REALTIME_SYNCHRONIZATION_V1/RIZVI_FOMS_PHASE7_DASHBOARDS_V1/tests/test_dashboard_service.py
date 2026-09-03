from app.dashboard_service import summarize_status,REFRESH_SECONDS
def test_refresh_contract():
    assert REFRESH_SECONDS==3
def test_summary():
    x=summarize_status([
        {'status':'OPEN'},{'status':'IN_PROGRESS'},{'status':'OVERDUE'},
        {'status':'APPROVED'},{'status':'CLOSED'}])
    assert x['total']==5
    assert x['active']==2
    assert x['attention']==1
    assert x['completed']==2
