Attribute VB_Name = "Modulo43"
Private Sub cmdTornaIndice_Click()
    Me.Hide
    Sheets("frmIndice").Activate
    frmIndice.Show
End Sub

Private Sub cmdVaiPagina01_Click()
    Me.Hide
    Sheets("frmpagina01").Activate
    frmPagina01.Show
End Sub

Private Sub cmdVaiPagina02_Click()
    Me.Hide
    Sheets("frmpagina02").Activate
    frmPagina02.Show
End Sub

Private Sub cmdVaiPagina03_Click()
    Me.Hide
    Sheets("frmpagina03").Activate
    frmPAGINA03.Show
End Sub

Private Sub cmdVaiPagina04_Click()
    Me.Hide
    Sheets("frmpagina04").Activate
    frmPAGINA04.Show
End Sub

Private Sub btnChiudi_Click()
    ' Chiudi il form corrente
    Unload Me
End Sub
